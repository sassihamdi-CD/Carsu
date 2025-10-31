/**
 * Purpose: Guard to enforce active tenant membership on tenant-scoped resources.
 * Usage: Applied to any controller or method handling tenant data (boards, todos etc).
 * Why: Prevents users from accessing or modifying data of tenants they are not members of.
 * Notes: Used together with JwtAuthGuard for layered security.
 */
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { X_TENANT_ID } from '../../common/constants/headers';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly tenantsService: TenantsService) {}

  /**
   * Ensure request has an active tenant and the user is a member of it.
   * Attaches activeTenantId to the request on success.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user as { userId?: string } | undefined;
    const tenantIdHeader = (req.headers[X_TENANT_ID] || req.headers['X-Tenant-Id']) as string | undefined;
    const tenantId = typeof tenantIdHeader === 'string' ? tenantIdHeader.trim() : undefined;
    // Enforce header/param alignment when param is present
    const paramsTenantId: string | undefined = req.params?.tenantId;
    if (tenantId && paramsTenantId && tenantId !== paramsTenantId) {
      throw new ForbiddenException('Tenant mismatch');
    }

    if (!user?.userId || !tenantId) {
      throw new ForbiddenException('Tenant access denied');
    }

    const isMember = await this.tenantsService.isUserMemberOfTenant(user.userId, tenantId);
    if (!isMember) {
      throw new ForbiddenException('Tenant access denied');
    }

    // Stash for downstream usage
    req.activeTenantId = tenantId;
    return true;
  }
}
