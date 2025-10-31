/**
 * Purpose: Socket.IO client for real-time collaboration with the backend.
 * Usage: Called from App.tsx to establish WebSocket connection for real-time updates.
 * Why: Handles Socket.IO connection lifecycle, authentication, and reconnection logic.
 * Notes: Connects with JWT token and tenant ID for authenticated, tenant-scoped communication.
 */
import { io, Socket } from 'socket.io-client';

// Force port 4000 - API is exposed on port 4000 via docker-compose
const API_URL = 'http://localhost:4000';
console.log('[Socket] API_URL (hardcoded):', API_URL);

/**
 * Creates and returns a Socket.IO client connected to the backend.
 * @param token - JWT token for authentication (from login/signup)
 * @param tenantId - Active tenant ID to scope the connection
 * @returns Configured Socket.IO client instance
 */
export function connectSocket(token: string, tenantId: string): Socket {
  console.log('[Socket] Connecting to:', API_URL, 'with tenantId:', tenantId);
  const socket = io(API_URL, {
    transports: ['websocket', 'polling'],
    auth: { token: `Bearer ${token}`, tenantId },
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });
  
  socket.on('connect', () => {
    console.log('[Socket] ✅ Connected! Socket ID:', socket.id);
  });
  
  socket.on('disconnect', (reason) => {
    console.log('[Socket] ❌ Disconnected:', reason);
  });
  
  socket.on('connect_error', (error) => {
    console.error('[Socket] ❌ Connection error:', error);
  });
  
  return socket;
}


