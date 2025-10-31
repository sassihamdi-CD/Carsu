/**
 * Purpose: Unit tests for JWT guard/strategy behavior (auth feature).
 * Scope:
 *  - Strategy validate mapping payload -> principal
 *  - Guard public bypass via @Public metadata
 *  - Guard normalizes unauthorized errors when no user
 * Why: Ensures authentication cross-cutting concerns are predictable and safe.
 */
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtStrategy } from '../../src/modules/auth/jwt.strategy';
import { JwtAuthGuard } from '../../src/modules/auth/jwt-auth.guard';

describe('JwtAuthGuard and JwtStrategy', () => {
  it('JwtStrategy.validate maps payload to principal', async () => {
    // Arrange & Act
    const s = new JwtStrategy({
      get: () => undefined,
      getOrThrow: () => 'secret',
    } as any);
    const res = await s.validate({ sub: 'u1' } as any);
    // Assert
    expect(res).toEqual({ userId: 'u1' });
  });

  it('JwtAuthGuard allows @Public()', () => {
    // Arrange
    const reflector = { getAllAndOverride: () => true } as unknown as Reflector;
    const guard = new JwtAuthGuard(reflector);
    const ctx = { getHandler: () => ({}), getClass: () => ({}) } as unknown as ExecutionContext;
    // Assert
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('JwtAuthGuard.handleRequest throws when no user', () => {
    // Arrange
    const reflector = { getAllAndOverride: () => false } as unknown as Reflector;
    const guard = new JwtAuthGuard(reflector);
    // Assert
    expect(() => guard.handleRequest(null, null as any)).toThrow();
  });
});


