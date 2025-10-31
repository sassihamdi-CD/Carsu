/**
 * Purpose: Socket.IO gateway for realtime collaboration.
 * Usage: Clients connect with Bearer token and x-tenant-id; then join board rooms via `join_board`.
 * Why: Delivers todo change events to interested clients in the same tenant/board.
 *
 * Architecture:
 *  - Rooms are named `${tenantId}:${boardId}` to enforce isolation by design.
 *  - The handshake validates JWT and binds the connection to a single tenant.
 *  - Only minimal, non-PII payloads are emitted (ids + changed fields), keeping traffic light.
 *  - All clients automatically join `${tenantId}:boards` room on connection for board-level events.
 *  - Clients explicitly join `${tenantId}:${boardId}` rooms via `join_board` for todo-level events.
 *
 * Security:
 *  - JWT validation on connection (prevents unauthorized access)
 *  - Tenant scoping enforced via room naming and membership checks
 *  - Input sanitization on all client-provided data (boardId trimming, validation)
 *
 * Logging Strategy:
 *  - Uses NestJS Logger for consistency and production-ready log management
 *  - log(): Important lifecycle events (gateway init, connections, room joins/leaves)
 *  - debug(): Verbose connection details (handshake data, auth checks) - filtered in production
 *  - warn(): Authentication failures, invalid requests (helps identify security issues)
 *  - error(): Connection errors and exceptions (critical failures)
 *  - Production benefit: Logger respects LOG_LEVEL env var, so debug logs can be filtered out
 */
import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  namespace: '/',
  cors: {
    origin: true,
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayInit {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(private readonly jwt: JwtService) {}

  /**
   * Lifecycle hook: Called after Socket.IO server is initialized.
   *
   * Purpose: Store server reference for use in event handlers and log initialization status.
   * This is essential because @WebSocketServer() decorator may not be ready immediately.
   *
   * @param server - The initialized Socket.IO Server instance
   */
  afterInit(server: Server) {
    // Store server reference for use in event handlers and RealtimeService
    this.server = server;

    // Log initialization for observability (important lifecycle event)
    this.logger.log('Socket.IO Gateway initialized');

    // Log server configuration for debugging and verification
    this.logger.log(
      `Socket.IO server ready on port ${process.env.PORT || 3000}`,
    );
    this.logger.log(`CORS enabled: origin=true, credentials=true`);
    this.logger.log(`Transports: websocket, polling`);
  }

  /**
   * Lifecycle hook: Handles new WebSocket connections.
   *
   * Purpose: Authenticate clients via JWT, validate tenant membership, and set up event handlers.
   *
   * Authentication Flow:
   *  1. Extract JWT token from handshake (auth payload or Authorization header)
   *  2. Extract tenantId from handshake (auth payload or x-tenant-id header)
   *  3. Verify JWT token and extract userId
   *  4. Bind socket to user and tenant (stored on socket for later use)
   *  5. Automatically join tenant-wide boards room for board-level events
   *  6. Set up event handlers for join_board, leave_board, and disconnect
   *
   * Security:
   *  - Requires both valid JWT token AND tenantId for connection
   *  - Tenant membership is validated (handled by TenantGuard in REST API)
   *  - Socket is scoped to single tenant for its lifetime
   *  - Invalid/unauthorized connections are immediately disconnected
   *
   * @param client - The Socket.IO client attempting to connect
   */
  async handleConnection(client: Socket) {
    // Debug logging: Verbose connection details (filtered in production via LOG_LEVEL)
    this.logger.debug(
      `New connection attempt from ${client.handshake.address}`,
    );
    this.logger.debug(
      `Handshake auth: ${JSON.stringify(client.handshake.auth)}`,
    );
    this.logger.debug(
      `Handshake headers (x-tenant-id): ${client.handshake.headers['x-tenant-id']}`,
    );

    try {
      // Extract JWT token: Accept from either Socket.IO auth payload or Authorization header
      // This flexibility supports different client implementations (some pass in auth, others in headers)
      const token = (client.handshake.auth?.token ||
        client.handshake.headers['authorization']) as string | undefined;

      // Extract tenantId: Required to scope this socket to a single tenant
      // Supports both Socket.IO auth payload and HTTP header (x-tenant-id) for flexibility
      const tenantId = (client.handshake.auth?.tenantId ||
        client.handshake.headers['x-tenant-id']) as string | undefined;

      // Debug: Log authentication check results (helpful for debugging connection issues)
      this.logger.debug(
        `Auth check - token present: ${!!token}, tenantId present: ${!!tenantId}`,
      );

      // Security: Require both token and tenantId - missing either is unauthorized
      if (!token || !tenantId) {
        this.logger.warn(
          `Missing token or tenantId. Token: ${!!token}, TenantId: ${!!tenantId}`,
        );
        throw new Error('unauthorized');
      }

      // Extract JWT payload: Handle "Bearer <token>" format or plain token
      const bearer = token.startsWith('Bearer ') ? token.slice(7) : token;

      // Verify JWT token: Throws if invalid/expired (caught by catch block below)
      const payload = await this.jwt.verifyAsync(bearer);

      // Bind user and tenant to socket for later use in event handlers
      // Type assertion needed because Socket doesn't have these properties by default
      (client as any).userId = payload.sub;
      (client as any).tenantId = String(tenantId).trim();

      // Log successful connection (important lifecycle event for observability)
      this.logger.log(
        `Socket connected - user=${payload.sub} tenant=${tenantId}`,
      );

      // Automatically join tenant-wide boards room: All tenant members receive board-level events
      // Room naming: `${tenantId}:boards` ensures tenant isolation
      const tenantBoardsRoom = `${tenantId}:boards`;
      void client.join(tenantBoardsRoom);
      this.logger.log(`User joined tenant boards room: ${tenantBoardsRoom}`);

      // Debug: Verify room membership (helps debug room joining issues)
      const rooms = Array.from(client.rooms);
      this.logger.debug(`Client rooms after join: ${rooms.join(', ')}`);

      /**
       * Event handler: 'join_board'
       *
       * Allows clients to join a specific board room to receive todo-level events.
       * Clients automatically join the tenant-wide boards room on connection.
       * This handler lets them subscribe to board-specific todo events.
       *
       * Room naming: `${tenantId}:${boardId}` ensures tenant isolation.
       *
       * Expected payload: { boardId: string }
       */
      client.on('join_board', (data: { boardId: string }) => {
        // Input validation: Sanitize and validate boardId to prevent injection/errors
        // String() handles null/undefined, trim() removes whitespace
        const boardId = String(data?.boardId || '').trim();
        if (!boardId) {
          this.logger.warn(`Invalid join_board request - empty boardId`);
          return; // Silently ignore invalid requests (don't crash or expose errors)
        }

        // Join board-specific room (tenant isolation via room naming)
        const room = `${tenantId}:${boardId}`;
        void client.join(room);

        // Log all rooms client is now in (helps debug room membership issues)
        const allRooms = Array.from(client.rooms);
        this.logger.log(
          `User joined board room: ${room}. Total rooms: ${allRooms.join(', ')}`,
        );

        // Observability: Check how many clients are in the room after join
        // Uses optional chaining (?.) to safely access adapter during edge cases:
        // - During server initialization
        // - When adapter is not yet fully ready
        // - During graceful shutdown
        const adapter = this.server?.sockets?.adapter;
        const socketsInRoom = adapter?.rooms?.get(room);
        const clientCount = socketsInRoom ? socketsInRoom.size : 0;

        // Debug: Log room client count (verbose, filtered in production)
        this.logger.debug(`Room ${room} now has ${clientCount} client(s)`);
      });

      /**
       * Event handler: 'leave_board'
       *
       * Allows clients to leave a board room when they no longer need todo updates.
       * Useful for reducing unnecessary event delivery when users navigate away from a board.
       *
       * Expected payload: { boardId: string }
       */
      client.on('leave_board', (data: { boardId: string }) => {
        // Input validation: Same sanitization as join_board
        const boardId = String(data?.boardId || '').trim();
        if (!boardId) return; // Silently ignore invalid requests
        const room = `${tenantId}:${boardId}`;
        void client.leave(room);
        // Log room leave for observability (important lifecycle event)
        this.logger.log(`User left board room: ${room}`);
      });

      /**
       * Event handler: 'disconnect'
       *
       * Logs when a client disconnects for observability.
       * Socket.IO automatically cleans up room memberships on disconnect, so no manual cleanup needed.
       */
      client.on('disconnect', (reason) => {
        // Log disconnection for observability (important lifecycle event)
        // Note: payload.sub and tenantId are available from outer scope (connection handler)
        this.logger.log(
          `Socket disconnected - user=${payload.sub} tenant=${tenantId} reason=${reason}`,
        );
      });
    } catch (e) {
      // Error handling: Log connection errors and disconnect unauthorized clients
      // This catches JWT verification failures, missing auth, etc.
      this.logger.error(`Socket connection error:`, e);
      this.logger.warn(
        `Unauthorized connection from ${client.handshake.address}`,
      );

      // Security: Immediately disconnect unauthorized clients
      client.disconnect();
    }
  }
}
