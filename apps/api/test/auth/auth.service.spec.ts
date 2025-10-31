/**
 * Purpose: Unit tests for AuthService business logic.
 * Scope:
 *  - signup: happy path, unique email conflict mapping
 *  - login: unknown user rejection
 *  - getProfile: returns user and tenant memberships
 * Why: Ensures core auth flows are correct, secure, and regression-safe.
 */
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../../src/modules/auth/auth.service';
import { PrismaService } from '../../src/common/prisma/prisma.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: jest.Mocked<PrismaService>;
  let jwt: jest.Mocked<JwtService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: {
          user: { findUnique: jest.fn(), create: jest.fn() },
          tenant: { create: jest.fn() },
          userTenant: { create: jest.fn() },
          $transaction: jest.fn(async (fn: any) => {
            return fn({ user: { create: prisma.user.create }, tenant: { create: prisma.tenant.create }, userTenant: { create: prisma.userTenant.create } });
          })
        }},
        { provide: JwtService, useValue: { signAsync: jest.fn().mockResolvedValue('token') } },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(undefined), getOrThrow: jest.fn().mockReturnValue('secret') } },
      ],
    }).compile();

    service = module.get(AuthService);
    prisma = module.get(PrismaService) as any;
    jwt = module.get(JwtService) as any;
  });

  it('signup creates user/tenant/membership and returns token', async () => {
    // Arrange: user does not exist; create user + tenant + membership
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.user.create as jest.Mock).mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    (prisma.tenant.create as jest.Mock).mockResolvedValue({ id: 't1', name: 'x' });
    (prisma.userTenant.create as jest.Mock).mockResolvedValue({});

    // Act
    const res = await service.signup('USER@EXAMPLE.COM', 'Strongpass1');
    // Assert
    expect(res).toEqual({ token: 'token', userId: 'u1' });
  });

  it('signup maps unique email to ConflictException', async () => {
    // Arrange: simulate Prisma unique constraint error
    const err: any = { code: 'P2002' };
    (prisma.$transaction as jest.Mock).mockRejectedValue(err);
    // Assert
    await expect(service.signup('a@b.c', 'Strongpass1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('login throws Unauthorized for unknown user', async () => {
    // Arrange: no user found
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    // Assert
    await expect(service.login('x@y.z', 'pass')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('getProfile returns user and memberships', async () => {
    // Arrange: user exists with memberships
    (prisma.user as any).findUnique = jest.fn().mockResolvedValue({ id: 'u1', email: 'a@b.c' });
    (prisma.userTenant as any).findMany = jest.fn().mockResolvedValue([
      { tenantId: 't1', role: 'member', tenant: { name: 'Acme' } },
    ]);
    // Act
    const res = await service.getProfile('u1');
    // Assert
    expect(res.user.id).toBe('u1');
    expect(res.tenants[0]).toEqual({ id: 't1', name: 'Acme', role: 'member' });
  });
});


