/**
 * Purpose: Bundle tenants controller/service for membership listing and checks.
 * Usage: Imported by AppModule to expose tenant-related endpoints.
 * Why: Encapsulates tenant membership logic and provides TenantService for other modules.
 * Notes: Exports TenantsService for use by TenantGuard and other modules requiring membership checks.
 */
import { Module } from '@nestjs/common';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { PrismaService } from '../../common/prisma/prisma.service';

@Module({
  controllers: [TenantsController],
  providers: [TenantsService, PrismaService],
  exports: [TenantsService],
})
export class TenantsModule {}
