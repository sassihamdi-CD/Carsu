/**
 * Purpose: Bundle health-related components (controller + indicators).
 * Usage: Imported by AppModule to expose /health for liveness/readiness checks.
 * Why: Keeps operational health probes isolated and extensible (add more indicators later).
 */
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { PrismaHealthIndicator } from './prisma.health';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [PrismaHealthIndicator],
})
export class HealthModule {}


