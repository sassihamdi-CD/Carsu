/**
 * Purpose: Realtime module providing a Socket.IO gateway and a simple publisher service.
 * Usage: Import into AppModule; other services inject RealtimeService to emit events.
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { RealtimeGateway } from './realtime.gateway.js';
import { RealtimeService } from './realtime.service.js';

@Module({
  imports: [AuthModule],
  providers: [RealtimeGateway, RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
