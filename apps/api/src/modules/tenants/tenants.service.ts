/**
 * Purpose: Centralizes business logic for tenant membership, ownership, and related queries.
 * Usage: Used by TenantsController and other domain services to check user-tenant relationships.
 * Why: Keeps tenant membership isolation rules in one place—reducing risk of bugs/IDOR.
 * Notes: Must always enforce user membership when reading tenant-bound data.
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async listUserTenants(userId: string) {
    // Fetch memberships including tenant names; return minimal summaries for client use
    const memberships = await this.prisma.userTenant.findMany({
      where: { userId },
      include: { tenant: true },
      orderBy: { tenantId: 'asc' },
    });
    return memberships.map((m) => ({ id: m.tenantId, name: m.tenant.name, role: m.role }));
  }

  async isUserMemberOfTenant(userId: string, tenantId: string): Promise<boolean> {
    // Use composite PK lookup for fast membership check
    const membership = await this.prisma.userTenant.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
    });
    return Boolean(membership);
  }
}

