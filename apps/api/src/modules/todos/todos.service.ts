/**
 * Purpose: Business logic for todos scoped by tenant and board.
 * Usage: Called by TodosController after JwtAuthGuard + TenantGuard validation.
 * Why: Centralizes scoping, validation, and persistence (404 vs 403), and provides
 *       a single place to add cross-cutting concerns (caching, logging, realtime emits).
 * Notes:
 *  - All queries are tenant-scoped, and board-scoped where applicable (IDOR resistant).
 *  - First-page caching only; cache failures are tolerated to avoid surfacing infra issues.
 *
 * Logging Strategy:
 * - log(): Important business events (todo created, updated, deleted) for audit trail
 * - debug(): Realtime event emissions (verbose, filtered in production via LOG_LEVEL)
 * - error(): Critical failures (realtime emission errors, cache failures are silently handled)
 */
import {
  Inject,
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantsService } from '../tenants/tenants.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { TodoStatusDto } from './dto/todo.dto';
import { RealtimeService } from '../realtime/realtime.service';

@Injectable()
export class TodosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantsService: TenantsService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly realtime: RealtimeService,
  ) {}

  private readonly logger = new Logger(TodosService.name);

  private async ensureMembership(userId: string, tenantId: string) {
    // Composite membership check; prevents non-members from accessing tenant data (403)
    const ok = await this.tenantsService.isUserMemberOfTenant(userId, tenantId);
    if (!ok) throw new ForbiddenException('Tenant access denied');
  }

  async listTodos(
    userId: string,
    tenantId: string,
    boardId: string,
    cursor?: string,
    limit = 20,
  ) {
    await this.ensureMembership(userId, tenantId);
    // Cache only the first page per (tenant, board) to speed up common views
    const cacheKey = cursor
      ? undefined
      : `tenant:${tenantId}:board:${boardId}:todos:first:${limit}`;
    if (cacheKey) {
      try {
        const c = await this.cache.get(cacheKey);
        if (c) return c as any;
      } catch {
        // Cache read failures are non-critical; proceed with database query
      }
    }
    // Cursor pagination in stable id order; over-fetch by 1 to compute hasMore
    const take = limit;
    const query = await this.prisma.todo.findMany({
      where: { tenantId, boardId },
      orderBy: { id: 'asc' },
      select: { id: true, title: true, status: true, assigneeUserId: true },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: take + 1,
    });
    // Trim to page size and compute next cursor
    const data = query.slice(0, take);
    const nextCursor =
      query.length > take ? data[data.length - 1]?.id : undefined;
    const response = {
      data,
      meta: { nextCursor, hasMore: Boolean(nextCursor) },
    };
    if (cacheKey) {
      // Short TTL; swallow cache errors (observability will still capture logs/metrics)
      try {
        await this.cache.set(cacheKey, response, 60_000 as any);
      } catch {
        // Cache write failures are non-critical; continue without caching
      }
    }
    return response;
  }

  async createTodo(
    userId: string,
    tenantId: string,
    boardId: string,
    title: string,
    description: string | undefined,
    status: TodoStatusDto,
    assigneeUserId?: string,
  ) {
    await this.ensureMembership(userId, tenantId);
    // Ensure board belongs to tenant
    // Ensure target board belongs to tenant to avoid cross-tenant writes
    const board = await this.prisma.board.findFirst({
      where: { id: boardId, tenantId },
      select: { id: true },
    });
    if (!board) throw new NotFoundException('Board not found');
    const todo = await this.prisma.todo.create({
      data: {
        tenantId,
        boardId,
        title,
        description: description ?? '',
        status: status as any,
        assigneeUserId: assigneeUserId ?? null,
      },
      select: { id: true, title: true, status: true, assigneeUserId: true },
    });
    // Invalidate first page cache quietly
    try {
      await this.cache.del(
        `tenant:${tenantId}:board:${boardId}:todos:first:20`,
      );
    } catch {
      // Cache invalidation failures are non-critical
    }
    this.logger.log(
      `todo_created tenant=${tenantId} board=${boardId} todo=${todo.id}`,
    );
    // Include boardId in payload so frontend can filter if needed (though room membership should handle this)
    try {
      this.realtime.emitToBoard(tenantId, boardId, 'todo.created', {
        ...todo,
        boardId,
      });
      this.logger.debug(
        `Emitted todo.created event for tenant ${tenantId} board ${boardId}`,
      );
    } catch (err) {
      this.logger.error(`Failed to emit todo.created event:`, err);
    }
    return todo;
  }

  async getTodo(userId: string, tenantId: string, todoId: string) {
    await this.ensureMembership(userId, tenantId);
    const todo = await this.prisma.todo.findFirst({
      where: { id: todoId, tenantId },
      select: {
        id: true,
        title: true,
        status: true,
        assigneeUserId: true,
        boardId: true,
      },
    });
    if (!todo) throw new NotFoundException('Todo not found');
    return todo;
  }

  async updateTodo(
    userId: string,
    tenantId: string,
    todoId: string,
    patch: Partial<{
      title: string;
      description: string;
      status: TodoStatusDto;
      assigneeUserId: string | null;
    }>,
  ) {
    await this.ensureMembership(userId, tenantId);
    // Scope fetch by tenant to prevent leaking existence
    const exists = await this.prisma.todo.findFirst({
      where: { id: todoId, tenantId },
      select: { id: true, boardId: true },
    });
    if (!exists) throw new NotFoundException('Todo not found');
    // Scope update by tenant; updateMany yields 404-like behavior when no match
    const updated = await this.prisma.todo.updateMany({
      where: { id: todoId, tenantId },
      data: patch as any,
    });
    if (updated.count === 0) throw new NotFoundException('Todo not found');
    // Invalidate first page cache quietly
    try {
      await this.cache.del(
        `tenant:${tenantId}:board:${exists.boardId}:todos:first:20`,
      );
    } catch {
      // Cache invalidation failures are non-critical
    }
    this.logger.log(`todo_updated tenant=${tenantId} todo=${todoId}`);
    // Emit realtime event for todo update (silently handle failures)
    try {
      this.realtime.emitToBoard(tenantId, exists.boardId, 'todo.updated', {
        id: todoId,
        boardId: exists.boardId,
        ...patch,
      });
      this.logger.debug(
        `Emitted todo.updated event for tenant ${tenantId} board ${exists.boardId}`,
      );
    } catch (err) {
      this.logger.error(`Failed to emit todo.updated event:`, err);
    }
    return this.getTodo(userId, tenantId, todoId);
  }

  async deleteTodo(userId: string, tenantId: string, todoId: string) {
    await this.ensureMembership(userId, tenantId);
    // Confirm todo belongs to tenant before deleting
    const exists = await this.prisma.todo.findFirst({
      where: { id: todoId, tenantId },
      select: { id: true, boardId: true },
    });
    if (!exists) throw new NotFoundException('Todo not found');
    // Scope delete by tenant; deleteMany gives safe count for 404 mapping
    const del = await this.prisma.todo.deleteMany({
      where: { id: todoId, tenantId },
    });
    if (del.count === 0) throw new NotFoundException('Todo not found');
    // Invalidate first page cache quietly
    try {
      await this.cache.del(
        `tenant:${tenantId}:board:${exists.boardId}:todos:first:20`,
      );
    } catch {}
    this.logger.log(`todo_deleted tenant=${tenantId} todo=${todoId}`);
    // Emit realtime event for todo deletion (silently handle failures)
    try {
      this.realtime.emitToBoard(tenantId, exists.boardId, 'todo.deleted', {
        id: todoId,
        boardId: exists.boardId,
      });
      this.logger.debug(
        `Emitted todo.deleted event for tenant ${tenantId} board ${exists.boardId}`,
      );
    } catch (err) {
      this.logger.error(`Failed to emit todo.deleted event:`, err);
    }
    return { deleted: true };
  }
}
