/**
 * Purpose: Unit tests for RealtimeService covering event emission to Socket.IO rooms.
 * Approach: Mock RealtimeGateway and Socket.IO Server. Validate room naming, defensive checks, and logging.
 */
import { RealtimeService } from '../../src/modules/realtime/realtime.service';

describe('RealtimeService', () => {
  let service: RealtimeService;
  let gateway: any;
  let mockServer: any;
  let mockAdapter: any;
  let mockRooms: any;

  beforeEach(async () => {
    // Mock Socket.IO rooms structure: Map<roomName, Set<socketId>>
    mockRooms = new Map();
    
    // Mock Socket.IO adapter with rooms
    mockAdapter = {
      rooms: mockRooms,
    };
    
    // Mock Socket.IO server with sockets.adapter
    mockServer = {
      sockets: {
        adapter: mockAdapter,
      },
      to: jest.fn().mockReturnValue({
        emit: jest.fn(),
      }),
    };
    
    // Mock RealtimeGateway with server
    gateway = {
      server: mockServer,
    };

    // Create service directly with mocked gateway (simpler than full DI setup)
    service = new RealtimeService(gateway);
  });

  /**
   * Verifies: emitToBoard constructs correct room name with tenant and board IDs.
   * Expectation: emits to room `${tenantId}:${boardId}` with correct event and payload.
   */
  it('emits event to board room with correct naming', () => {
    const tenantId = 'tenant-123';
    const boardId = 'board-456';
    const event = 'todo.created';
    const payload = { id: 'todo-789', title: 'New task' };
    
    // Mock room with one client
    const roomSet = new Set(['socket-1']);
    mockRooms.set(`${tenantId}:${boardId}`, roomSet);
    
    service.emitToBoard(tenantId, boardId, event, payload);
    
    // Verify correct room name was used
    expect(mockServer.to).toHaveBeenCalledWith(`${tenantId}:${boardId}`);
    expect(mockServer.to().emit).toHaveBeenCalledWith(event, payload);
  });

  /**
   * Verifies: emitToTenant constructs correct tenant-wide room name.
   * Expectation: emits to room `${tenantId}:boards` with correct event and payload.
   */
  it('emits event to tenant room with correct naming', () => {
    const tenantId = 'tenant-123';
    const event = 'board.created';
    const payload = { id: 'board-456', name: 'New Board' };
    
    // Mock tenant room with clients
    const roomSet = new Set(['socket-1', 'socket-2']);
    mockRooms.set(`${tenantId}:boards`, roomSet);
    
    service.emitToTenant(tenantId, event, payload);
    
    // Verify correct tenant room name was used
    expect(mockServer.to).toHaveBeenCalledWith(`${tenantId}:boards`);
    expect(mockServer.to().emit).toHaveBeenCalledWith(event, payload);
  });

  /**
   * Verifies: emitToBoard silently skips emission when server is not ready.
   * Expectation: returns early without calling emit when server is undefined.
   */
  it('skips emission when server is not ready (server undefined)', () => {
    gateway.server = undefined;
    
    service.emitToBoard('tenant-1', 'board-1', 'todo.created', {});
    
    expect(mockServer.to).not.toHaveBeenCalled();
  });

  /**
   * Verifies: emitToBoard silently skips emission when sockets is not ready.
   * Expectation: returns early without calling emit when sockets is undefined.
   */
  it('skips emission when sockets is not ready', () => {
    gateway.server = { sockets: undefined };
    
    service.emitToBoard('tenant-1', 'board-1', 'todo.created', {});
    
    expect(mockServer.to).not.toHaveBeenCalled();
  });

  /**
   * Verifies: emitToTenant silently skips emission when server is not ready.
   * Expectation: returns early without calling emit when server is undefined.
   */
  it('skips tenant emission when server is not ready', () => {
    gateway.server = undefined;
    
    service.emitToTenant('tenant-1', 'board.created', {});
    
    expect(mockServer.to).not.toHaveBeenCalled();
  });

  /**
   * Verifies: emitToBoard handles empty rooms gracefully (adapter.rooms undefined).
   * Expectation: emits even when adapter.rooms is undefined (defensive programming).
   */
  it('emits to board room even when adapter.rooms is undefined', () => {
    mockAdapter.rooms = undefined;
    
    service.emitToBoard('tenant-1', 'board-1', 'todo.created', { id: 'todo-1' });
    
    // Should still emit (defensive programming - Socket.IO handles empty rooms)
    expect(mockServer.to).toHaveBeenCalledWith('tenant-1:board-1');
    expect(mockServer.to().emit).toHaveBeenCalled();
  });

  /**
   * Verifies: emitToTenant handles empty rooms gracefully (adapter.rooms undefined).
   * Expectation: emits even when adapter.rooms is undefined.
   */
  it('emits to tenant room even when adapter.rooms is undefined', () => {
    mockAdapter.rooms = undefined;
    
    service.emitToTenant('tenant-1', 'board.created', { id: 'board-1' });
    
    // Should still emit
    expect(mockServer.to).toHaveBeenCalledWith('tenant-1:boards');
    expect(mockServer.to().emit).toHaveBeenCalled();
  });

  /**
   * Verifies: emitToBoard correctly counts clients in room for logging.
   * Expectation: room with 2 clients should be counted correctly.
   */
  it('counts clients in board room correctly', () => {
    const roomName = 'tenant-1:board-1';
    const roomSet = new Set(['socket-1', 'socket-2']);
    mockRooms.set(roomName, roomSet);
    
    const loggerSpy = jest.spyOn(service['logger'], 'debug');
    
    service.emitToBoard('tenant-1', 'board-1', 'todo.created', {});
    
    // Verify debug log includes client count
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.stringContaining('2 client(s)')
    );
  });

  /**
   * Verifies: emitToBoard logs warning when emitting to empty room.
   * Expectation: warns when no clients are in the room.
   */
  it('warns when emitting to empty board room', () => {
    // Room doesn't exist (empty)
    const loggerSpy = jest.spyOn(service['logger'], 'warn');
    
    service.emitToBoard('tenant-1', 'board-1', 'todo.created', {});
    
    // Verify warning was logged
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.stringContaining('No clients in room tenant-1:board-1')
    );
  });

  /**
   * Verifies: emitToTenant logs warning when emitting to empty tenant room.
   * Expectation: warns when no clients are in the tenant room.
   */
  it('warns when emitting to empty tenant room', () => {
    // Tenant room doesn't exist (empty)
    const loggerSpy = jest.spyOn(service['logger'], 'warn');
    
    service.emitToTenant('tenant-1', 'board.created', {});
    
    // Verify warning was logged
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.stringContaining('No clients in tenant room tenant-1:boards')
    );
  });
});
