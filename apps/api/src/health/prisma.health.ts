/**
 * Purpose: Health indicator that checks Postgres connectivity via Prisma.
 * Usage: Used by HealthController to include DB status in /health responses.
 * Why: Confirms critical dependency availability; enables readiness gates.
 * Notes: Replace raw query with lightweight read against a known table if desired.
 */
import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaHealthIndicator extends HealthIndicator {
  private readonly prisma = new PrismaClient();

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
      return this.getStatus(key, true);
    } catch (e) {
      return this.getStatus(key, false, { error: (e as Error).message });
    }
  }
}


