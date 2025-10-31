/**
 * Purpose: Bundle tenants controller/service for membership listing and checks.
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


