/**
 * Purpose: Unit tests for TodosService covering tenant/board scoping, pagination,
 *          caching, and CRUD behaviors with clear error mapping.
 * Approach: Mock Prisma, TenantsService, and Cache; validate that methods enforce
 *           membership (403), scope queries by tenant/board (404 when absent), and
 *           interact with cache safely (first page only).
 */
import { Test } from '@nestjs/testing';
import { TodosService } from '../../src/modules/todos/todos.service';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { TenantsService } from '../../src/modules/tenants/tenants.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TodoStatusDto } from '../../src/modules/todos/dto/todo.dto';
import { RealtimeService } from '../../src/modules/realtime/realtime.service';

describe('TodosService', () => {
  let service: TodosService;
  let prisma: any;
  let tenants: any;
  let cache: any;

  beforeEach(async () => {
    prisma = {
      todo: {
        findMany: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      board: {
        findFirst: jest.fn(),
      },
    };
    tenants = { isUserMemberOfTenant: jest.fn().mockResolvedValue(true) };
    cache = { get: jest.fn(), set: jest.fn(), del: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        TodosService,
        { provide: PrismaService, useValue: prisma },
        { provide: TenantsService, useValue: tenants },
        { provide: CACHE_MANAGER, useValue: cache },
        { provide: RealtimeService, useValue: { emitToBoard: jest.fn() } },
      ],
    }).compile();

    service = module.get(TodosService);
  });

  /**
   * Verifies: listTodos enforces membership, paginates by cursor, and caches first page.
   * Expectation: returns data/meta, attempts to cache when no cursor is provided.
   */
  it('lists todos with pagination and caches first page', async () => {
    prisma.todo.findMany.mockResolvedValueOnce([
      { id: 't1', title: 'A', status: 'TODO', assigneeUserId: null },
      { id: 't2', title: 'B', status: 'TODO', assigneeUserId: null },
    ]);
    const res = await service.listTodos('u1', 'tenant', 'board', undefined, 1);
    expect(res.data.length).toBe(1);
    expect(res.meta.hasMore).toBe(true);
    expect(cache.set).toHaveBeenCalled();
  });

  /**
   * Verifies: listTodos rejects for non-member users.
   */
  it('denies when not a member', async () => {
    tenants.isUserMemberOfTenant.mockResolvedValueOnce(false);
    await expect(service.listTodos('u1', 'tenant', 'board')).rejects.toBeInstanceOf(ForbiddenException);
  });

  /**
   * Verifies: createTodo ensures board belongs to tenant; inserts and invalidates page cache.
   */
  it('creates todo and invalidates cache', async () => {
    prisma.board.findFirst.mockResolvedValueOnce({ id: 'board' });
    prisma.todo.create.mockResolvedValueOnce({ id: 't1', title: 'Task', status: 'TODO', assigneeUserId: null });
    const out = await service.createTodo('u1', 'tenant', 'board', 'Task', 'desc', TodoStatusDto.TODO);
    expect(out.id).toBe('t1');
    expect(cache.del).toHaveBeenCalled();
  });

  /**
   * Verifies: createTodo maps missing board to 404.
   */
  it('fails to create when board is not in tenant', async () => {
    prisma.board.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.createTodo('u1', 'tenant', 'boardX', 'Task', undefined, TodoStatusDto.TODO),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  /**
   * Verifies: getTodo scopes by tenant and returns 404 when absent.
   */
  it('gets todo within tenant or 404', async () => {
    prisma.todo.findFirst.mockResolvedValueOnce({ id: 't1', title: 'Task', status: 'TODO', assigneeUserId: null, boardId: 'b' });
    const ok = await service.getTodo('u1', 'tenant', 't1');
    expect(ok.id).toBe('t1');
    prisma.todo.findFirst.mockResolvedValueOnce(null);
    await expect(service.getTodo('u1', 'tenant', 't2')).rejects.toBeInstanceOf(NotFoundException);
  });

  /**
   * Verifies: updateTodo scopes update by tenant and maps to 404 when not found.
   */
  it('updates todo or 404', async () => {
    // Arrange: exists -> updateMany -> subsequent getTodo returns updated entity
    prisma.todo.findFirst.mockResolvedValueOnce({ id: 't1', boardId: 'b' });
    prisma.todo.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.todo.findFirst.mockResolvedValueOnce({ id: 't1', title: 'Task', status: 'IN_PROGRESS', assigneeUserId: null, boardId: 'b' });
    const updated = await service.updateTodo('u1', 'tenant', 't1', { status: TodoStatusDto.IN_PROGRESS });
    expect(updated.status).toBe('IN_PROGRESS');
    prisma.todo.findFirst.mockResolvedValueOnce(null);
    await expect(service.updateTodo('u1', 'tenant', 'tX', { title: 'X' })).rejects.toBeInstanceOf(NotFoundException);
  });

  /**
   * Verifies: deleteTodo scopes delete by tenant and yields 204 semantics when found.
   */
  it('deletes todo or 404', async () => {
    prisma.todo.findFirst.mockResolvedValueOnce({ id: 't1', boardId: 'b' });
    prisma.todo.deleteMany.mockResolvedValueOnce({ count: 1 });
    const out = await service.deleteTodo('u1', 'tenant', 't1');
    expect(out).toEqual({ deleted: true });
    prisma.todo.findFirst.mockResolvedValueOnce(null);
    await expect(service.deleteTodo('u1', 'tenant', 'tX')).rejects.toBeInstanceOf(NotFoundException);
  });
});


