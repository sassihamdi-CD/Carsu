/**
 * Purpose: Todos feature module (tenant- and board-scoped tasks with realtime readiness).
 * Usage: Registers controller and service to manage todos under a board within a tenant.
 * Why: Keeps todo CRUD isolated with strict scoping and clear DTO contracts.
 */
import { Module } from '@nestjs/common';
import { TodosController } from './todos.controller';
import { TodosService } from './todos.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantsService } from '../tenants/tenants.service';
import { RealtimeModule } from '../realtime/realtime.module.js';

@Module({
  imports: [RealtimeModule],
  controllers: [TodosController],
  providers: [TodosService, PrismaService, TenantsService],
})
export class TodosModule {}


