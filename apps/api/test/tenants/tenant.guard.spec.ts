/**
 * Purpose: Unit tests for TenantGuard membership enforcement.
 * Scope:
 *  - allows when user is member of tenant (header provided)
 *  - rejects when no header or not a member
 *  - rejects when header and route param mismatch
 */
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { TenantGuard } from '../../src/modules/tenants/tenant.guard';

describe('TenantGuard', () => {
  const makeCtx = (userId?: string, headerTenant?: string, paramTenant?: string) => {
    const req: any = {
      headers: headerTenant ? { 'x-tenant-id': headerTenant } : {},
      user: userId ? { userId } : undefined,
      params: paramTenant ? { tenantId: paramTenant } : {},
    };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
    return { ctx, req };
  };

  it('allows when user is member and header matches param', async () => {
    const svc = { isUserMemberOfTenant: jest.fn().mockResolvedValue(true) } as any;
    const guard = new TenantGuard(svc);
    const { ctx } = makeCtx('u1', 't1', 't1');
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('rejects when header missing', async () => {
    const svc = { isUserMemberOfTenant: jest.fn() } as any;
    const guard = new TenantGuard(svc);
    const { ctx } = makeCtx('u1', undefined, 't1');
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects when not a member', async () => {
    const svc = { isUserMemberOfTenant: jest.fn().mockResolvedValue(false) } as any;
    const guard = new TenantGuard(svc);
    const { ctx } = makeCtx('u1', 't1', 't1');
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects when header/param mismatch', async () => {
    const svc = { isUserMemberOfTenant: jest.fn().mockResolvedValue(true) } as any;
    const guard = new TenantGuard(svc);
    const { ctx } = makeCtx('u1', 't1', 't2');
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });
});


