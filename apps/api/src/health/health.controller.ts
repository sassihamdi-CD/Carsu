/**
 * Purpose: Expose liveness/readiness endpoint for orchestration and monitoring.
 * Usage: GET /health returns DB status via Prisma; used by Docker/K8s probes.
 * Why: Early detection of failures and safe rollouts; standard SRE practice.
 * Notes: Extend with additional indicators (cache, message bus) as the system grows.
 */
import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { PrismaHealthIndicator } from './prisma.health';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prisma: PrismaHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.prisma.isHealthy('database')]);
  }
}


