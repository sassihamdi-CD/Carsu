/**
 * Purpose: Thin publisher abstraction to emit realtime events to Socket.IO rooms.
 * Usage: Inject into domain services (e.g., TodosService) to emit after DB writes.
 * Why: Centralizes room naming and emission so we can evolve transport (e.g., Redis adapter) later.
 *
 * Defensive Programming:
 * - Validates server readiness before accessing Socket.IO adapter to prevent crashes during startup/shutdown
 * - Uses optional chaining (?.) when accessing adapter.rooms to handle edge cases gracefully
 * - Logs client counts for observability; warns when emitting to empty rooms (helpful for debugging)
 * - Silently skips emission if server isn't ready rather than throwing (prevents cascading failures)
 *
 * Logging Strategy:
 * - Uses NestJS Logger for consistency and production-ready log management
 * - debug(): Verbose emission details (can be disabled in production via LOG_LEVEL)
 * - warn(): Important warnings that indicate potential issues (server not ready, empty rooms)
 * - Production benefit: Logger respects LOG_LEVEL env var, so debug logs can be filtered out
 */
import { Injectable, Logger } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway.js';

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);

  constructor(private readonly gateway: RealtimeGateway) {}

  /**
   * Emits an event to all clients in a specific board room.
   *
   * Room naming: `${tenantId}:${boardId}` ensures strict tenant isolation.
   * Only clients that have explicitly joined this board room will receive the event.
   *
   * @param tenantId - The tenant identifier (ensures multi-tenant isolation)
   * @param boardId - The board identifier within the tenant
   * @param event - Event name (e.g., 'todo.created', 'todo.updated', 'todo.deleted')
   * @param payload - Event payload (should contain minimal, non-sensitive data: ids + changed fields)
   *
   * Example: emitToBoard('tenant-123', 'board-456', 'todo.created', { id: 'todo-789', title: 'New task' })
   */
  emitToBoard(
    tenantId: string,
    boardId: string,
    event: string,
    payload: unknown,
  ) {
    // Defensive check: Ensure server and sockets are initialized before accessing adapter
    // This prevents "Cannot read properties of undefined" errors during:
    // - Application startup (before gateway is fully initialized)
    // - Application shutdown (when connections are being torn down)
    // - Hot-reload scenarios in development
    if (!this.gateway.server || !this.gateway.server.sockets) {
      this.logger.warn(
        `Server not ready, skipping ${event} to board ${boardId}`,
      );
      return;
    }

    // Room naming convention: tenant-scoped board rooms for strict isolation
    const room = `${tenantId}:${boardId}`;

    // Safely access adapter with optional chaining to handle edge cases
    // Adapter may be undefined in rare cases (e.g., adapter initialization race conditions)
    const adapter = this.gateway.server.sockets.adapter;
    const socketsInRoom = adapter?.rooms?.get(room);
    const clientCount = socketsInRoom ? socketsInRoom.size : 0;

    // Observability: Log emission details for debugging and monitoring
    this.logger.debug(
      `Emitting ${event} to room ${room} (${clientCount} client(s))`,
    );

    // Helpful warning when emitting to empty rooms (indicates client not joined or disconnected)
    // This doesn't block emission (client might reconnect and miss the event, but that's acceptable)
    if (clientCount === 0) {
      this.logger.warn(
        `No clients in room ${room}! Event ${event} will not be delivered.`,
      );
    }

    // Emit to room (Socket.IO handles delivery; no-op if room is empty, which is fine)
    this.gateway.server.to(room).emit(event, payload);
  }

  /**
   * Emits an event to all clients in a tenant's board list room.
   *
   * Room naming: `${tenantId}:boards` - all members of a tenant automatically join this room
   * upon connection. Used for board-level events (board.created, board.updated, board.deleted)
   * that affect the board list, not individual todos.
   *
   * @param tenantId - The tenant identifier
   * @param event - Event name (e.g., 'board.created', 'board.updated', 'board.deleted')
   * @param payload - Event payload (should contain minimal data: id + changed fields)
   *
   * Example: emitToTenant('tenant-123', 'board.created', { id: 'board-456', name: 'New Board' })
   */
  emitToTenant(tenantId: string, event: string, payload: unknown) {
    // Defensive check: Same protection as emitToBoard
    if (!this.gateway.server || !this.gateway.server.sockets) {
      this.logger.warn(
        `Server not ready, skipping ${event} to tenant ${tenantId}`,
      );
      return;
    }

    // Tenant-wide room for board list updates (all tenant members are in this room)
    const room = `${tenantId}:boards`;

    // Safe adapter access with optional chaining
    const adapter = this.gateway.server.sockets.adapter;
    const socketsInRoom = adapter?.rooms?.get(room);
    const clientCount = socketsInRoom ? socketsInRoom.size : 0;

    // Observability logging
    this.logger.debug(
      `Emitting ${event} to tenant room ${room} (${clientCount} client(s))`,
    );

    // Warning if no clients in tenant room (helps identify connection issues)
    if (clientCount === 0) {
      this.logger.warn(
        `No clients in tenant room ${room}! Event ${event} will not be delivered.`,
      );
    }

    // Emit to tenant-wide room
    this.gateway.server.to(room).emit(event, payload);
  }
}
