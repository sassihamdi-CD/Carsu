/**
 * Purpose: Centralizes business logic for tenant membership, ownership, and related queries.
 * Usage: Used by TenantsController and other domain services to check user-tenant relationships.
 * Why: Keeps tenant membership isolation rules in one place—reducing risk of bugs/IDOR.
 * Notes: Must always enforce user membership when reading tenant-bound data.
 *
 * Logging Strategy:
 * - Minimal logging (membership checks are high-frequency, would be too verbose)
 * - Future: Consider adding debug logging for membership operations if needed for troubleshooting
 */
import {
  Injectable,
  NotFoundException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listUserTenants(userId: string) {
    // Fetch memberships including tenant names; return minimal summaries for client use
    const memberships = await this.prisma.userTenant.findMany({
      where: { userId },
      include: { tenant: true },
      orderBy: { tenantId: 'asc' },
    });
    return memberships.map((m) => ({
      id: m.tenantId,
      name: m.tenant.name,
      role: m.role,
    }));
  }

  async isUserMemberOfTenant(
    userId: string,
    tenantId: string,
  ): Promise<boolean> {
    // Use composite PK lookup for fast membership check
    const membership = await this.prisma.userTenant.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
    });
    return Boolean(membership);
  }

  async addUserToTenantByEmail(tenantId: string, email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new NotFoundException('User not found');
    await this.prisma.userTenant.upsert({
      where: { userId_tenantId: { userId: user.id, tenantId } },
      update: {},
      create: { userId: user.id, tenantId, role: 'member' },
    });
    return { tenantId, userId: user.id };
  }

  /**
   * Delete a tenant and all associated data (boards, todos, memberships).
   * Cascade deletes are handled by Prisma schema (onDelete: Cascade).
   * Only members can delete tenants (in production, you might want owner-only deletion).
   */
  async deleteTenant(userId: string, tenantId: string) {
    // Ensure user is a member of the tenant
    const isMember = await this.isUserMemberOfTenant(userId, tenantId);
    if (!isMember) {
      throw new ForbiddenException(
        'You must be a member of the tenant to delete it',
      );
    }

    // Verify tenant exists
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Delete tenant (cascade will delete boards, todos, and UserTenant memberships)
    await this.prisma.tenant.delete({ where: { id: tenantId } });

    this.logger.log(`Tenant deleted - tenant=${tenantId} by user=${userId}`);

    return { deleted: true, tenantId };
  }
}
