/**
 * Purpose: Business logic for tenant-scoped boards.
 * Usage: Called by BoardsController after guards validate authentication and tenant membership.
 * Why: Centralizes data access and rules (scoping by tenant, 404 vs 403 decisions, projections).
 * Notes: Uses minimal Prisma selects for performance; add pagination in listBoards if needed.
 *
 * Logging Strategy:
 * - log(): Important business events (board created, updated, deleted) for audit trail
 * - debug(): Realtime event emissions (verbose, filtered in production via LOG_LEVEL)
 * - error(): Critical failures (realtime emission errors, cache failures are silently handled)
 */
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantsService } from '../tenants/tenants.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { RealtimeService } from '../realtime/realtime.service.js';

@Injectable()
export class BoardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantsService: TenantsService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly realtime: RealtimeService,
  ) {}

  private readonly logger = new Logger(BoardsService.name);

  /**
   * Ensure the user is a member of the tenant. Throws Forbidden otherwise.
   */
  private async ensureMembership(userId: string, tenantId: string) {
    // Fast membership check using composite key (userId, tenantId)
    const ok = await this.tenantsService.isUserMemberOfTenant(userId, tenantId);
    if (!ok) throw new ForbiddenException('Tenant access denied');
  }

  /**
   * Return summaries of boards in a tenant ordered by creation time.
   */
  async listBoards(
    userId: string,
    tenantId: string,
    cursor?: string,
    limit = 20,
  ) {
    await this.ensureMembership(userId, tenantId);
    // Cache strategy: only cache first page (no cursor) per tenant to speed up dashboard loads.
    // Subsequent pages (with cursor) are not cached to avoid complex invalidation.
    const cacheKey = cursor
      ? undefined
      : `tenant:${tenantId}:boards:first:${limit}`;
    if (cacheKey) {
      try {
        // Return cached envelope { data, meta } if available
        const cached = await this.cache.get(cacheKey);
        if (cached) return cached as any;
      } catch {
        // Cache read failures are non-critical; proceed with database query
      }
    }
    // Cursor-based pagination, stable order by id
    const take = limit;
    const query = await this.prisma.board.findMany({
      where: { tenantId },
      orderBy: { id: 'asc' },
      select: { id: true, name: true },
      // When cursor present, skip the cursor item to avoid duplication
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: take + 1, // fetch one extra to detect hasMore
    });
    // Trim to requested page size and compute nextCursor
    const data = query.slice(0, take);
    const nextCursor =
      query.length > take ? data[data.length - 1]?.id : undefined;
    const response = {
      data,
      meta: { nextCursor, hasMore: Boolean(nextCursor) },
    };
    if (cacheKey) {
      // Set short TTL; tolerate cache failures silently to avoid impacting API
      try {
        await this.cache.set(cacheKey, response, 60_000 as any);
      } catch {
        // Cache write failures are non-critical; continue without caching
      }
    }
    return response;
  }

  /**
   * Create a board within a tenant and return its summary.
   */
  async createBoard(userId: string, tenantId: string, name: string) {
    await this.ensureMembership(userId, tenantId);
    // Insert within tenant scope
    const board = await this.prisma.board.create({ data: { tenantId, name } });
    // Invalidate first page cache for this tenant; ignore cache errors
    try {
      await this.cache.del(`tenant:${tenantId}:boards:first:20`);
    } catch {
      // Cache invalidation failures are non-critical
    }
    this.logger.log(`board_created tenant=${tenantId} board=${board.id}`);
    // Emit realtime event for board creation (silently handle failures to avoid cascading errors)
    try {
      this.realtime.emitToTenant(tenantId, 'board.created', {
        id: board.id,
        name: board.name,
      });
      this.logger.debug(`Emitted board.created event for tenant ${tenantId}`);
    } catch (err) {
      this.logger.error(`Failed to emit board.created event:`, err);
    }
    return { id: board.id, name: board.name };
  }

  /**
   * Get a single board by id within a tenant or 404 if not found.
   */
  async getBoard(userId: string, tenantId: string, boardId: string) {
    await this.ensureMembership(userId, tenantId);
    // Ensure the board belongs to the tenant to prevent IDOR
    const board = await this.prisma.board.findFirst({
      where: { id: boardId, tenantId },
      select: { id: true, name: true },
    });
    if (!board) throw new NotFoundException('Board not found');
    return board;
  }

  /**
   * Update a board name after ensuring it belongs to the tenant.
   */
  async updateBoard(
    userId: string,
    tenantId: string,
    boardId: string,
    name: string,
  ) {
    await this.ensureMembership(userId, tenantId);
    // Double-check existence within tenant (clarifies 404 vs 403 semantics)
    const exists = await this.prisma.board.findFirst({
      where: { id: boardId, tenantId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Board not found');
    // Scope the update by tenantId to guarantee isolation even if called directly with id
    const updated = await this.prisma.board.updateMany({
      where: { id: boardId, tenantId },
      data: { name },
    });
    if (updated.count === 0) throw new NotFoundException('Board not found');
    // Invalidate cached first page quietly
    try {
      await this.cache.del(`tenant:${tenantId}:boards:first:20`);
    } catch {}
    this.logger.log(`board_updated tenant=${tenantId} board=${boardId}`);
    // Emit realtime event for board update (silently handle failures)
    try {
      this.realtime.emitToTenant(tenantId, 'board.updated', {
        id: boardId,
        name,
      });
      this.logger.debug(`Emitted board.updated event for tenant ${tenantId}`);
    } catch (err) {
      this.logger.error(`Failed to emit board.updated event:`, err);
    }
    return { id: boardId, name };
  }

  /**
   * Delete a board by id after tenant ownership check.
   */
  async deleteBoard(userId: string, tenantId: string, boardId: string) {
    await this.ensureMembership(userId, tenantId);
    // Ensure board exists within tenant prior to delete
    const exists = await this.prisma.board.findFirst({
      where: { id: boardId, tenantId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Board not found');
    // Scope the delete by tenantId to avoid accidental cross-tenant deletes
    const del = await this.prisma.board.deleteMany({
      where: { id: boardId, tenantId },
    });
    if (del.count === 0) throw new NotFoundException('Board not found');
    // Invalidate cached first page quietly
    try {
      await this.cache.del(`tenant:${tenantId}:boards:first:20`);
    } catch {
      // Cache invalidation failures are non-critical
    }
    this.logger.log(`board_deleted tenant=${tenantId} board=${boardId}`);
    // Emit realtime event for board deletion (silently handle failures)
    try {
      this.realtime.emitToTenant(tenantId, 'board.deleted', { id: boardId });
      this.logger.debug(`Emitted board.deleted event for tenant ${tenantId}`);
    } catch (err) {
      this.logger.error(`Failed to emit board.deleted event:`, err);
    }
    return { deleted: true };
  }
}
