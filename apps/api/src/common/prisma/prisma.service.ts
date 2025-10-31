/**
 * Purpose: Shared Prisma service for DB access with graceful shutdown hooks.
 * Usage: Inject into services to perform tenant-scoped queries.
 * Why: Single PrismaClient across app; proper lifecycle management.
 */
import { INestApplication, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }

  async enableShutdownHooks(app: INestApplication) {
    // Cast to any due to Prisma Client event type limitations in TS
    (this as any).$on('beforeExit', async () => {
      await app.close();
    });
  }
}
