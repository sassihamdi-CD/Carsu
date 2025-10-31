/**
 * Purpose: Unit tests for TenantsService membership listing and mapping.
 * Scope: Verifies listUserTenants returns minimal summaries (id, name, role).
 * Why: Ensures tenant isolation helpers are correct and predictable.
 */
import { Test } from '@nestjs/testing';
import { TenantsService } from '../../src/modules/tenants/tenants.service';
import { PrismaService } from '../../src/common/prisma/prisma.service';

describe('TenantsService', () => {
  it('lists memberships mapped to summaries', async () => {
    // Arrange: mocked Prisma returns two memberships
    const module = await Test.createTestingModule({
      providers: [
        TenantsService,
        {
          provide: PrismaService,
          useValue: {
            userTenant: {
              findMany: jest.fn().mockResolvedValue([
                { tenantId: 't1', role: 'member', tenant: { name: 'Acme' } },
                { tenantId: 't2', role: 'admin', tenant: { name: 'Globex' } },
              ]),
            },
          },
        },
      ],
    }).compile();

    const s = module.get(TenantsService);
    // Act
    const res = await s.listUserTenants('u1');
    // Assert
    expect(res).toEqual([
      { id: 't1', name: 'Acme', role: 'member' },
      { id: 't2', name: 'Globex', role: 'admin' },
    ]);
  });
});
