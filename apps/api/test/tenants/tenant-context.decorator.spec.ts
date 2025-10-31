/**
 * Purpose: Unit tests for ActiveTenant decorator.
 * Scope:
 *  - returns guard-injected activeTenantId if present
 *  - falls back to x-tenant-id header when missing
 */
import { ActiveTenant } from '../../src/modules/tenants/tenant-context.decorator';
import { ExecutionContext } from '@nestjs/common';

describe('ActiveTenant decorator', () => {
  const getValue = (req: any) => {
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
    const decoratorFn = (ActiveTenant as any)();
    return decoratorFn(undefined, ctx) as string | undefined;
  };

  it('prefers req.activeTenantId', () => {
    const req = { activeTenantId: 't1', headers: { 'x-tenant-id': 't2' } };
    expect(getValue(req)).toBe('t1');
  });

  it('falls back to header', () => {
    const req = { headers: { 'x-tenant-id': 't2 ' } };
    expect(getValue(req)).toBe('t2');
  });
});


