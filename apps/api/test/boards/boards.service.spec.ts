/**
 * Purpose: Unit tests for BoardsService covering tenant scoping, pagination, caching, and mutations.
 * Approach: Mock Prisma, TenantsService, and Cache. Validate behavior and error mapping.
 */
import { Test } from '@nestjs/testing';
import { BoardsService } from '../../src/modules/boards/boards.service';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { TenantsService } from '../../src/modules/tenants/tenants.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('BoardsService', () => {
  let service: BoardsService;
  let prisma: any;
  let tenants: any;
  let cache: any;

  beforeEach(async () => {
    prisma = {
      board: {
        findMany: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
    tenants = { isUserMemberOfTenant: jest.fn().mockResolvedValue(true) };
    cache = { get: jest.fn(), set: jest.fn(), del: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        BoardsService,
        { provide: PrismaService, useValue: prisma },
        { provide: TenantsService, useValue: tenants },
        { provide: CACHE_MANAGER, useValue: cache },
      ],
    }).compile();

    service = module.get(BoardsService);
  });

  /**
   * Verifies: listBoards enforces membership, applies cursor pagination, and caches first page responses.
   * Expectation: returns one item with hasMore=true and attempts to cache the envelope.
   */
  it('lists boards with cursor pagination and caching first page', async () => {
    prisma.board.findMany.mockResolvedValueOnce([
      { id: 'b1', name: 'A' },
      { id: 'b2', name: 'B' },
    ]);
    const res = await service.listBoards('u1', 't1', undefined, 1);
    expect(res.data.length).toBe(1);
    expect(res.meta.hasMore).toBe(true);
    expect(cache.set).toHaveBeenCalled();
  });

  /**
   * Verifies: listBoards rejects when the user is not a member of the tenant.
   * Expectation: ForbiddenException is thrown.
   */
  it('denies when not a member', async () => {
    tenants.isUserMemberOfTenant.mockResolvedValueOnce(false);
    await expect(service.listBoards('u1', 't1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  /**
   * Verifies: createBoard inserts within tenant scope and invalidates first-page cache.
   * Expectation: returns created summary and calls cache.del.
   */
  it('creates board and invalidates cache', async () => {
    prisma.board.create.mockResolvedValueOnce({ id: 'b1', name: 'N' });
    const out = await service.createBoard('u1', 't1', 'N');
    expect(out).toEqual({ id: 'b1', name: 'N' });
    expect(cache.del).toHaveBeenCalled();
  });

  /**
   * Verifies: getBoard scopes by tenant and maps missing board to 404.
   * Expectation: returns board on success; NotFoundException when absent.
   */
  it('gets board within tenant or 404', async () => {
    prisma.board.findFirst.mockResolvedValueOnce({ id: 'b1', name: 'N' });
    const ok = await service.getBoard('u1', 't1', 'b1');
    expect(ok.id).toBe('b1');
    prisma.board.findFirst.mockResolvedValueOnce(null);
    await expect(service.getBoard('u1', 't1', 'b2')).rejects.toBeInstanceOf(NotFoundException);
  });

  /**
   * Verifies: updateBoard scopes update by tenant and returns 404 when not found.
   * Expectation: returns updated summary; NotFoundException when absent.
   */
  it('updates board in tenant or 404', async () => {
    prisma.board.findFirst.mockResolvedValueOnce({ id: 'b1' });
    prisma.board.updateMany.mockResolvedValueOnce({ count: 1 });
    const out = await service.updateBoard('u1', 't1', 'b1', 'X');
    expect(out).toEqual({ id: 'b1', name: 'X' });
    // missing
    prisma.board.findFirst.mockResolvedValueOnce(null);
    await expect(service.updateBoard('u1', 't1', 'b3', 'Y')).rejects.toBeInstanceOf(NotFoundException);
  });

  /**
   * Verifies: deleteBoard scopes delete by tenant and returns 404 when not found.
   * Expectation: returns { deleted: true } on success; NotFoundException when absent.
   */
  it('deletes board in tenant or 404', async () => {
    prisma.board.findFirst.mockResolvedValueOnce({ id: 'b1' });
    prisma.board.deleteMany.mockResolvedValueOnce({ count: 1 });
    const out = await service.deleteBoard('u1', 't1', 'b1');
    expect(out).toEqual({ deleted: true });
    prisma.board.findFirst.mockResolvedValueOnce(null);
    await expect(service.deleteBoard('u1', 't1', 'b2')).rejects.toBeInstanceOf(NotFoundException);
  });
});


