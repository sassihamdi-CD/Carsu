/**
 * Purpose: Main React application component for the Carsu Todo frontend.
 * Usage: Root component handling authentication, tenant selection, board/todo management, and real-time updates.
 * Why: Centralizes all UI state management, API calls, and Socket.IO event handling in a single component.
 * Notes:
 *  - Implements optimistic UI updates for instant feedback
 *  - Manages Socket.IO connection lifecycle and event subscriptions
 *  - Handles tenant switching with proper socket reconnection
 *  - Provides CRUD operations for boards and todos with real-time synchronization
 */
import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { Socket } from 'socket.io-client';
import { connectSocket } from '../lib/socket';

type Tenant = { tenantId: string; name?: string; role: string };
type Board = { id: string; name: string };
type Todo = { id: string; title: string; status: 'TODO' | 'IN_PROGRESS' | 'DONE' };

export function App() {
  const [email, setEmail] = useState('bob@example.com');
  const [password, setPassword] = useState('Password123');
  const [error, setError] = useState<string | null>(null);
  const [isSignup, setIsSignup] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantId, setTenantId] = useState<string>('');
  const [boards, setBoards] = useState<Board[]>([]);
  const [boardId, setBoardId] = useState<string>('');
  const [boardName, setBoardName] = useState<string>('');
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [newBoardTitle, setNewBoardTitle] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [socketStatus, setSocketStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [currentTenantId, setCurrentTenantId] = useState<string>('');
  const socketRef = useMemo<{ current: Socket | null }>(() => ({ current: null }), []);
  const boardIdRef = React.useRef<string>('');
  
  // Auto-load boards when tenant changes
  useEffect(() => {
    if (tenantId && token) {
      loadBoards();
    }
  }, [tenantId, token]);

  const fetchTenants = async () => {
    try {
      console.log('[Tenant] Fetching tenants...');
      const memberships = await api.get<any[]>(`/v1/tenants`);
      const mapped: Tenant[] = (memberships || []).map((m: any) => ({
        tenantId: m.tenantId ?? m.id,
        name: m.name ?? m.tenantName ?? m.tenantId ?? m.id,
        role: m.role ?? '',
      })).filter((m: Tenant) => !!m.tenantId);
      console.log('[Tenant] Loaded tenants:', mapped);
      setTenants(mapped);
      // Don't auto-select tenant if one is already selected
      if (!tenantId && mapped[0]) {
        console.log('[Tenant] Auto-selecting first tenant:', mapped[0].tenantId);
        setTenantId(mapped[0].tenantId);
      }
      setError(null);
    } catch (e) {
      console.error('[Tenant] Failed to load tenants:', e);
      setError('Failed to load tenants');
    }
  };

  useEffect(() => {
    api.setToken(token);
  }, [token]);

  const login = async () => {
    setError(null);
    try {
      const res = await api.post<{ token: string; userId: string }>(`/v1/auth/login`, { email, password });
      api.setToken(res.token);
      setToken(res.token);
    } catch (e: any) {
      const errorMsg = e?.message || 'Invalid credentials';
      setError(errorMsg);
      console.error('Login error:', e);
      return;
    }
    await fetchTenants();
  };

  const signup = async () => {
    setError(null);
    try {
      const res = await api.post<{ token: string; userId: string }>(`/v1/auth/signup`, { email, password });
      api.setToken(res.token);
      setToken(res.token);
      await fetchTenants();
    } catch (e: any) {
      const errorMsg = e?.message || 'Sign up failed';
      setError(errorMsg);
      console.error('Signup error:', e);
    }
  };

  const loadBoards = async () => {
    if (!tenantId) return;
    try {
      const res = await api.get<{ data?: Board[]; items?: Board[] }>(`/v1/tenants/${tenantId}/boards?limit=50`, { 'x-tenant-id': tenantId });
      setBoards((res as any)?.data ?? (res as any)?.items ?? []);
    } catch (e) {
      setError('Failed to load boards');
      console.error(e);
    }
  };

  const createBoard = async () => {
    if (!tenantId || !newBoardTitle.trim()) return;
    try {
      console.log('[Board] Creating board:', newBoardTitle.trim(), 'in tenant:', tenantId);
      const created = await api.post<Board>(`/v1/tenants/${tenantId}/boards`, { name: newBoardTitle.trim() }, { 'x-tenant-id': tenantId });
      console.log('[Board] Board created:', created);
      setNewBoardTitle('');
      // Optimistically update the list so the user sees it immediately
      setBoards((prev) => {
        const exists = (prev || []).some(x => x.id === created.id);
        return exists ? prev : [created, ...(prev || [])];
      });
    } catch (e) {
      console.error('[Board] Failed to create board:', e);
      setError('Failed to create board');
    }
  };

  const inviteToTenant = async () => {
    if (!tenantId || !inviteEmail) return;
    try {
      await api.post(`/v1/tenants/${tenantId}/members`, { email: inviteEmail }, { 'x-tenant-id': tenantId });
      setInviteEmail('');
      await fetchTenants();
    } catch (e) {
      setError('Failed to invite user');
      console.error(e);
    }
  };

  const openBoard = async (id: string) => {
    boardIdRef.current = id;
    setBoardId(id);
    const current = (boards || []).find((b) => b.id === id);
    setBoardName(current?.name || '');
    if (!tenantId) return;
    
    try {
      const res = await api.get<{ data?: Todo[]; items?: Todo[] }>(`/v1/tenants/${tenantId}/boards/${id}/todos`, { 'x-tenant-id': tenantId });
      setTodos((res as any)?.data ?? (res as any)?.items ?? []);
    } catch (e) {
      setError('Failed to load todos');
      console.error(e);
    }
    
    if (socketRef.current) {
      const s = socketRef.current;
      if (s.connected) {
        console.log('[Socket] ✅ Socket connected, joining board room:', id);
        s.emit('join_board', { boardId: id });
      } else {
        s.once('connect', () => {
          console.log('[Socket] ✅ Socket connected, joining board room:', id);
          s.emit('join_board', { boardId: id });
        });
      }
    }
  };

  // SINGLE socket connection per tenant - handles ALL realtime events (boards + todos)
  useEffect(() => {
    console.log('[Socket] Effect triggered - token:', !!token, 'tenantId:', tenantId, 'currentTenantId:', currentTenantId);
    
    if (!token || !tenantId) {
      console.log('[Socket] No token or tenantId, disconnecting...');
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocketStatus('disconnected');
      }
      return;
    }
    
    if (socketRef.current && currentTenantId && currentTenantId !== tenantId) {
      console.log('[Socket] Tenant changed from', currentTenantId, 'to', tenantId, '- reconnecting...');
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocketStatus('disconnected');
    }
    
    if (!socketRef.current || currentTenantId !== tenantId) {
      console.log('[Socket] Creating new socket connection for tenant:', tenantId);
      setSocketStatus('connecting');
      setCurrentTenantId(tenantId);
      
      const s = connectSocket(token, tenantId);
      socketRef.current = s;
      
      s.on('connect', () => {
        console.log('[Socket] ✅ Connected to tenant:', tenantId);
        setSocketStatus('connected');
        if (boardId) {
          console.log('[Socket] Auto-joining board room:', boardId);
          s.emit('join_board', { boardId });
        }
      });
      
      s.on('disconnect', (reason) => {
        console.log('[Socket] ❌ Disconnected. Reason:', reason);
        setSocketStatus('disconnected');
      });
      
      s.on('connect_error', (err) => {
        console.error('[Socket] Connection error:', err);
        setSocketStatus('disconnected');
      });
      
      // BOARD EVENTS (tenant-wide room: tenantId:boards)
      s.on('board.created', (b: Board) => {
        console.log('[Socket] 📨 Received board.created:', b);
        setBoards((prev) => {
          const exists = (prev || []).some(x => x.id === b.id);
          if (exists) {
            console.log('[Socket] Board already exists, skipping:', b.id);
            return prev;
          }
          console.log('[Socket] ✅ Adding new board to list');
          return [b, ...(prev || [])];
        });
      });
      
      s.on('board.updated', (b: Board) => {
        console.log('[Socket] 📨 Received board.updated:', b);
        setBoards((prev) => (prev || []).map(x => x.id === b.id ? b : x));
      });
      
      s.on('board.deleted', (p: { id: string }) => {
        console.log('[Socket] 📨 Received board.deleted:', p);
        setBoards((prev) => (prev || []).filter(x => x.id !== p.id));
        if (boardId === p.id) {
          boardIdRef.current = '';
          setBoardId('');
          setBoardName('');
          setTodos([]);
        }
      });
      
      // TODO EVENTS (board-specific room: tenantId:boardId)
      s.on('todo.created', (payload: any) => {
        console.log('[Socket] 📨 Received todo.created:', payload, 'Current boardId:', boardIdRef.current);
        if (payload.boardId && payload.boardId === boardIdRef.current) {
          console.log('[Socket] ✅ Todo matches current board, updating UI');
          setTodos((t) => {
            const exists = (t || []).some(x => x.id === payload.id);
            if (exists) {
              console.log('[Socket] Todo already exists, skipping');
              return t;
            }
            return [{ id: payload.id, title: payload.title, status: payload.status }, ...(t || [])];
          });
        } else {
          console.log('[Socket] ⚠️ Todo does not match current board, ignoring. Expected:', boardIdRef.current, 'Got:', payload.boardId);
        }
      });
      
      s.on('todo.updated', (payload: any) => {
        console.log('[Socket] 📨 Received todo.updated:', payload, 'Current boardId:', boardIdRef.current);
        if (payload.boardId && payload.boardId === boardIdRef.current) {
          console.log('[Socket] ✅ Todo matches current board, updating UI');
          setTodos((t) => (t || []).map((x) => (x.id === payload.id ? { ...x, ...payload } as any : x)));
        } else {
          console.log('[Socket] ⚠️ Todo does not match current board, ignoring. Expected:', boardIdRef.current, 'Got:', payload.boardId);
        }
      });
      
      s.on('todo.deleted', (payload: { id: string; boardId?: string }) => {
        console.log('[Socket] 📨 Received todo.deleted:', payload, 'Current boardId:', boardIdRef.current);
        if (!payload.boardId || payload.boardId === boardIdRef.current) {
          console.log('[Socket] ✅ Todo matches current board, removing from UI');
          setTodos((t) => (t || []).filter((x) => x.id !== payload.id));
        } else {
          console.log('[Socket] ⚠️ Todo does not match current board, ignoring. Expected:', boardIdRef.current, 'Got:', payload.boardId);
        }
      });
    }
    
    return () => {
      console.log('[Socket] Cleanup effect - tenantId:', tenantId, 'token:', !!token);
    };
  }, [token, tenantId]);

  const createTodo = async () => {
    if (!tenantId || !boardId || !newTodoTitle) return;
    try {
      console.log('[Todo] Creating todo:', newTodoTitle, 'in board:', boardId, 'tenant:', tenantId);
      const created = await api.post<Todo>(`/v1/tenants/${tenantId}/boards/${boardId}/todos`, { title: newTodoTitle }, { 'x-tenant-id': tenantId });
      console.log('[Todo] Todo created:', created);
      setNewTodoTitle('');
      setTodos((prev) => {
        const exists = (prev || []).some(x => x.id === created.id);
        return exists ? prev : [created, ...(prev || [])];
      });
    } catch (e) {
      console.error('[Todo] Failed to create todo:', e);
      setError('Failed to create todo');
    }
  };

  const toggleTodo = async (id: string) => {
    if (!tenantId) return;
    const t = todos.find((x) => x.id === id);
    if (!t) return;
    const next: Todo['status'] = t.status === 'DONE' ? 'TODO' : 'DONE';
    await api.patch(`/v1/tenants/${tenantId}/todos/${id}`, { status: next }, { 'x-tenant-id': tenantId });
    setTodos((prev) => (prev || []).map(x => x.id === id ? { ...x, status: next } : x));
  };

  const deleteTodo = async (id: string) => {
    if (!tenantId) return;
    if (!confirm('Are you sure you want to delete this todo?')) return;
    try {
      await api.delete(`/v1/tenants/${tenantId}/todos/${id}`, { 'x-tenant-id': tenantId });
      setTodos((prev) => (prev || []).filter(x => x.id !== id));
    } catch (e) {
      console.error('[Todo] Failed to delete todo:', e);
      setError('Failed to delete todo');
    }
  };

  const deleteBoard = async (id: string) => {
    if (!tenantId) return;
    if (!confirm('Are you sure you want to delete this board? All todos in this board will be deleted.')) return;
    try {
      await api.delete(`/v1/tenants/${tenantId}/boards/${id}`, { 'x-tenant-id': tenantId });
      setBoards((prev) => (prev || []).filter(x => x.id !== id));
      if (boardId === id) {
        setBoardId('');
        setBoardName('');
        setTodos([]);
        boardIdRef.current = '';
      }
    } catch (e) {
      console.error('[Board] Failed to delete board:', e);
      setError('Failed to delete board');
    }
  };

  const deleteAllTodos = async () => {
    if (!tenantId || !boardId || todos.length === 0) return;
    if (!confirm(`Are you sure you want to delete all ${todos.length} todo(s) in this board? This action cannot be undone.`)) return;
    try {
      const deletePromises = todos.map(t => 
        api.delete(`/v1/tenants/${tenantId}/todos/${t.id}`, { 'x-tenant-id': tenantId })
      );
      await Promise.all(deletePromises);
      setTodos([]);
    } catch (e) {
      console.error('[Todo] Failed to delete all todos:', e);
      setError('Failed to delete all todos');
    }
  };

  const deleteAllBoards = async () => {
    if (!tenantId || boards.length === 0) return;
    if (!confirm(`Are you sure you want to delete all ${boards.length} board(s)? All todos in these boards will be deleted. This action cannot be undone.`)) return;
    try {
      const deletePromises = boards.map(b => 
        api.delete(`/v1/tenants/${tenantId}/boards/${b.id}`, { 'x-tenant-id': tenantId })
      );
      await Promise.all(deletePromises);
      setBoards([]);
      setBoardId('');
      setBoardName('');
      setTodos([]);
      boardIdRef.current = '';
    } catch (e) {
      console.error('[Board] Failed to delete all boards:', e);
      setError('Failed to delete all boards');
    }
  };

  const deleteWorkspace = async () => {
    if (!tenantId) return;
    const tenantName = tenants.find(t => t.tenantId === tenantId)?.name || tenantId;
    if (!confirm(`⚠️ WARNING: Are you sure you want to delete the workspace "${tenantName}"?\n\nThis will permanently delete:\n- All ${boards.length} board(s)\n- All todos in those boards\n- All member invitations\n\nThis action CANNOT be undone!`)) return;
    try {
      await api.delete(`/v1/tenants/${tenantId}`);
      
      const remainingTenants = tenants.filter(t => t.tenantId !== tenantId);
      
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocketStatus('disconnected');
      }
      
      setTenants((prev) => (prev || []).filter(t => t.tenantId !== tenantId));
      setTenantId('');
      setBoards([]);
      setBoardId('');
      setBoardName('');
      setTodos([]);
      boardIdRef.current = '';
      setCurrentTenantId('');
      
      if (remainingTenants.length > 0) {
        setTenantId(remainingTenants[0].tenantId);
      }
    } catch (e) {
      console.error('[Workspace] Failed to delete workspace:', e);
      setError('Failed to delete workspace');
    }
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'TODO':
        return 'Todo';
      case 'IN_PROGRESS':
        return 'In Progress';
      case 'DONE':
        return 'Done';
      default:
        return status;
    }
  };

  return (
    <div className="app-container">
      <div className="app-header">
        <h1>🚀 Carsu Todo</h1>
        <p className="app-subtitle">Multi-tenant collaborative todo management</p>
      </div>

      {!token ? (
        <div className="auth-container">
          <h2 style={{ marginBottom: 24, fontSize: 24, color: '#2d3748' }}>
            {isSignup ? 'Create Account' : 'Sign In'}
          </h2>
          <div className="auth-form">
            <div className="auth-input-group">
              <label>Email</label>
              <input
                className="auth-input"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (isSignup ? signup() : login())}
              />
            </div>
            <div className="auth-input-group">
              <label>Password</label>
              <input
                className="auth-input"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (isSignup ? signup() : login())}
              />
            </div>
            {error && <div className="error-message">{error}</div>}
            <div className="auth-buttons">
              <button className="btn btn-primary" onClick={isSignup ? signup : login} style={{ flex: 1 }}>
                {isSignup ? 'Sign Up' : 'Sign In'}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => { setIsSignup(!isSignup); setError(null); }}
              >
                {isSignup ? 'Have an account?' : 'Create account'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="dashboard">
          <div className="top-bar">
            <select
              className="tenant-selector"
              value={tenantId}
              onChange={(e) => {
                console.log('[UI] Tenant selector changed to:', e.target.value);
                setTenantId(e.target.value);
              }}
            >
              <option value="">Select a tenant...</option>
              {(tenants || []).map((t) => (
                <option key={t.tenantId} value={t.tenantId}>
                  {t.name || t.tenantId}
                </option>
              ))}
            </select>
            <button className="btn btn-secondary btn-sm" onClick={loadBoards} disabled={!tenantId}>
              ↻ Refresh
            </button>
            <div className={`status-badge ${socketStatus}`}>
              {socketStatus === 'connected' ? '●' : socketStatus === 'connecting' ? '⟳' : '○'} {socketStatus}
            </div>
            {tenantId && (
              <>
                <div className="tenant-info">
                  Tenant ID: {tenantId.substring(0, 8)}...
                </div>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={deleteWorkspace}
                  title="Delete workspace"
                >
                  🗑️ Delete Workspace
                </button>
              </>
            )}
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="main-content">
            <div className="sidebar">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0 }}>📋 Boards</h3>
                {boards.length > 0 && (
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={deleteAllBoards}
                    title="Delete all boards"
                  >
                    Delete All
                  </button>
                )}
              </div>
              
              <div className="invite-section">
                <div className="invite-input-group">
                  <input
                    className="input"
                    type="email"
                    placeholder="Invite user email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && inviteToTenant()}
                  />
                  <button
                    className="btn btn-success btn-sm"
                    onClick={inviteToTenant}
                    disabled={!tenantId || !inviteEmail}
                  >
                    Invite
                  </button>
                </div>
              </div>

              <div className="input-group" style={{ marginBottom: 16 }}>
                <input
                  className="input"
                  placeholder="New board name"
                  value={newBoardTitle}
                  onChange={(e) => setNewBoardTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && createBoard()}
                />
                <button
                  className="btn btn-primary btn-sm"
                  onClick={createBoard}
                  disabled={!tenantId || !newBoardTitle.trim()}
                >
                  + Add
                </button>
              </div>

              {boards.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">📭</div>
                  <div className="empty-state-text">No boards yet. Create one to get started!</div>
                </div>
              ) : (
                <ul className="boards-list">
                  {boards.map((b) => (
                    <li
                      key={b.id}
                      className={`board-item ${boardId === b.id ? 'active' : ''}`}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                        <button 
                          className="board-name" 
                          onClick={() => openBoard(b.id)}
                          style={{ flex: 1, textAlign: 'left' }}
                        >
                          {b.name}
                        </button>
                        <button
                          className="btn btn-danger btn-sm btn-icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteBoard(b.id);
                          }}
                          title="Delete board"
                        >
                          🗑️
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="content-area">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ margin: 0 }}>
                  {boardName ? (
                    <>
                      ✨ <span className="board-name-header">{boardName}</span>
                    </>
                  ) : (
                    'Select a board to view todos'
                  )}
                </h3>
                {boardId && todos.length > 0 && (
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={deleteAllTodos}
                    title="Delete all todos in this board"
                  >
                    Delete All Todos
                  </button>
                )}
              </div>

              {boardId && (
                <>
                  <div className="todo-form">
                    <input
                      className="input"
                      placeholder="What needs to be done?"
                      value={newTodoTitle}
                      onChange={(e) => setNewTodoTitle(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && createTodo()}
                    />
                    <button
                      className="btn btn-primary"
                      onClick={createTodo}
                      disabled={!newTodoTitle.trim()}
                    >
                      + Add Todo
                    </button>
                  </div>

                  {todos.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-state-icon">✅</div>
                      <div className="empty-state-text">No todos yet. Add one above!</div>
                    </div>
                  ) : (
                    <ul className="todos-list">
                      {todos.map((t) => (
                        <li key={t.id} className={`todo-item ${t.status === 'DONE' ? 'done' : ''}`}>
                          <input
                            type="checkbox"
                            className="todo-checkbox"
                            checked={t.status === 'DONE'}
                            onChange={() => toggleTodo(t.id)}
                          />
                          <span className="todo-title">{t.title}</span>
                          <span className={`todo-status ${t.status.toLowerCase().replace('_', '-')}`}>
                            {getStatusDisplay(t.status)}
                          </span>
                          <button
                            className="btn btn-danger btn-sm btn-icon"
                            onClick={() => deleteTodo(t.id)}
                            title="Delete todo"
                            style={{ marginLeft: 'auto' }}
                          >
                            🗑️
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}

              {!boardId && (
                <div className="empty-state">
                  <div className="empty-state-icon">👈</div>
                  <div className="empty-state-text">Select a board from the sidebar to start adding todos</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
