/**
 * Purpose: Implements Passport JWT extraction and validation logic for authenticated requests.
 * Usage: Plugged into the NestJS Auth module and used by JwtAuthGuard.
 * Why: Cleanly separates JWT parsing/verification—enabling clear guardrails before controllers access user context.
 * Notes: Validates and attaches user claims to requests for downstream use (e.g., role checks).
 */
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { Algorithm } from 'jsonwebtoken';

export interface JwtClaims {
  sub: string; // userId
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  /**
   * Configure the JWT strategy with issuer/audience/algorithm checks.
   * Tokens must be provided as Bearer tokens in the Authorization header.
   */
  constructor(config: ConfigService) {
    const alg = (config.get<string>('JWT_ALG') ?? 'HS256') as Algorithm;
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
      issuer: config.get<string>('JWT_ISSUER'),
      audience: config.get<string>('JWT_AUDIENCE'),
      algorithms: [alg],
    });
  }

  /**
   * Map JWT claims to a minimal principal accessible as req.user.
   */
  async validate(payload: JwtClaims) {
    return { userId: payload.sub };
  }
}
