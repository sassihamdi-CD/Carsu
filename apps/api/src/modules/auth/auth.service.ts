/**
 * Purpose: Encapsulate all authentication-related business logic (user creation, validation, JWT issuance).
 * Usage: Used by AuthController for signup and login; accessible to other services for current-user checks.
 * Why: Single-responsibility layer for auth; isolates credential and token logic from web/infra concerns.
 * Notes: Handles password hashing, user lookup, and token generation.
 *
 * Logging Strategy:
 * - log(): Authentication events (signup success, login success) for security audit trail
 * - Error logging: Prisma unique constraint violations are mapped to ConflictException (no extra logging needed)
 */
import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../common/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';

interface JwtPayload {
  sub: string; // userId
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  private readonly logger = new Logger(AuthService.name);

  /**
   * Trim and lowercase the provided email.
   */
  private normalizeEmail(emailRaw: string): string {
    return emailRaw.trim().toLowerCase();
  }

  /**
   * Build a human-friendly default tenant name based on the email.
   */
  private buildDefaultTenantName(email: string): string {
    return `${email}'s workspace`;
  }

  /**
   * Hash a plaintext password using bcrypt with configured salt rounds.
   */
  private async hashPassword(plain: string): Promise<string> {
    const saltRounds = Number(
      this.config.get<string>('BCRYPT_SALT_ROUNDS') ?? '10',
    );
    return bcrypt.hash(plain, saltRounds);
  }

  /**
   * Verify a plaintext password against a bcrypt hash.
   */
  private async verifyPassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  /**
   * Register a new user: creates user, default tenant, and membership in a transaction.
   * Returns a signed JWT and the new userId.
   */
  async signup(emailRaw: string, password: string) {
    const email = this.normalizeEmail(emailRaw);
    const passwordHash = await this.hashPassword(password);

    try {
      // Create user, default tenant, and membership in a transaction
      const result = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({ data: { email, passwordHash } });
        const tenant = await tx.tenant.create({
          data: { name: this.buildDefaultTenantName(email) },
        });
        await tx.userTenant.create({
          data: { userId: user.id, tenantId: tenant.id, role: 'member' },
        });
        return { user, tenant };
      });

      const token = await this.signToken({ sub: result.user.id });
      this.logger.log(`signup_success userId=${result.user.id}`);
      return { token, userId: result.user.id };
    } catch (err) {
      const code = err?.code;
      if (
        (err instanceof Prisma.PrismaClientKnownRequestError &&
          code === 'P2002') ||
        code === 'P2002'
      ) {
        // Unique constraint violation (likely email)
        throw new ConflictException('Email already in use');
      }
      throw err;
    }
  }

  /**
   * Authenticate a user by email/password. Returns JWT and userId on success.
   */
  async login(emailRaw: string, password: string) {
    const email = this.normalizeEmail(emailRaw);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const ok = await this.verifyPassword(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    const token = await this.signToken({ sub: user.id });
    this.logger.log(`login_success userId=${user.id}`);
    return { token, userId: user.id };
  }

  /**
   * Sign and return a JWT for the provided payload.
   */
  private async signToken(payload: JwtPayload): Promise<string> {
    return this.jwtService.signAsync(payload);
  }

  /**
   * Returns minimal user profile and tenant memberships for the current user.
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Unauthorized');
    const memberships = await this.prisma.userTenant.findMany({
      where: { userId },
      include: { tenant: true },
    });
    return {
      user: { id: user.id, email: user.email },
      tenants: memberships.map((m) => ({
        id: m.tenantId,
        name: m.tenant.name,
        role: m.role,
      })),
    };
  }
}
