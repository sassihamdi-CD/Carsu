/**
 * Purpose: Boards feature module (tenant-scoped project containers).
 * Usage: Registers controller and service to manage boards under a tenant.
 * Why: Keeps board CRUD isolated and reusable; composes Prisma and tenant membership checks.
 * Notes: All access must be tenant-scoped via JwtAuthGuard + TenantGuard at the controller.
 */
import { Module } from '@nestjs/common';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { BoardsController } from './boards.controller';
import { BoardsService } from './boards.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantsService } from '../tenants/tenants.service';

@Module({
  imports: [RealtimeModule],
  controllers: [BoardsController],
  providers: [BoardsService, PrismaService, TenantsService],
})
export class BoardsModule {}


