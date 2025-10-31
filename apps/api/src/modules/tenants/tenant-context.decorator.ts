/**
 * Purpose: Custom decorator to inject the active tenant ID from request context or headers.
 * Usage: Used in controllers/services to easily access which tenant a request is for.
 * Why: Promotes DRY code—avoids manual header parsing in every controller/route.
 * Notes: Always use in combination with tenant guard to guarantee authz.
 */
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { X_TENANT_ID } from '../../common/constants/headers';

export const ActiveTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const req = ctx.switchToHttp().getRequest();
    // Prefer value set by TenantGuard
    if (req.activeTenantId) return req.activeTenantId as string;
    // Fallback to header
    const header = (req.headers[X_TENANT_ID] || req.headers['X-Tenant-Id']) as string | undefined;
    return typeof header === 'string' ? header.trim() : undefined;
  },
);
