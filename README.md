# Carsu Take‑Home: Multi‑Tenant Collaborative Todo (Backend‑First)

A secure, multi‑tenant, real‑time todo application (Trello‑style boards) built with NestJS 10, TypeScript, Prisma, and PostgreSQL. Focused on tenant isolation, clean architecture, and clear APIs suitable for a senior backend engineer code review.

## Goals
- Strong multi‑tenancy with strict data isolation and anti‑IDOR guarantees
- Clear, maintainable REST API with DTO validation and uniform error model
- Real‑time board updates via WebSockets (Socket.IO) with per‑tenant/per‑board rooms
- Robust testing baseline (unit, integration, basic e2e), CI‑ready
- DX: pnpm, ESLint/Prettier, typed config, docker‑compose for easy setup

## Tech Stack
- Node.js, TypeScript, NestJS 10
- PostgreSQL (local; Supabase‑compatible), Prisma ORM
- WebSockets (Socket.IO) via NestJS Gateway
- Jest + ts‑jest + Supertest
- pnpm, ESLint/Prettier, @nestjs/config

## Overview of Architecture and Design Decisions

### High-Level Architecture

The application follows a **layered, modular architecture** built with NestJS. The diagram below illustrates the system architecture:

```mermaid
graph TB
    subgraph "Client Layer"
        WEB[React Frontend<br/>Port 5174]
        WS[Socket.IO Client]
    end

    subgraph "API Layer - NestJS"
        API[NestJS API Server<br/>Port 4000]
        
        subgraph "Modules"
            AUTH[Auth Module<br/>JWT Strategy]
            TENANT[Tenants Module<br/>Membership Management]
            BOARD[Boards Module<br/>CRUD Operations]
            TODO[Todos Module<br/>CRUD Operations]
            REALTIME[Realtime Module<br/>Socket.IO Gateway]
        end
        
        subgraph "Common Services"
            PRISMA[Prisma Service<br/>Database Client]
            CACHE[Cache Manager<br/>First Page Cache]
            GUARD[JWT & Tenant Guards<br/>Authorization]
        end
    end

    subgraph "Data Layer"
        PG[(PostgreSQL Database<br/>Port 5433)]
    end

    WEB -->|HTTP/REST| API
    WS -->|WebSocket| REALTIME
    API --> AUTH
    API --> TENANT
    API --> BOARD
    API --> TODO
    API --> REALTIME
    BOARD --> PRISMA
    TODO --> PRISMA
    TENANT --> PRISMA
    AUTH --> PRISMA
    BOARD --> CACHE
    TODO --> CACHE
    BOARD --> REALTIME
    TODO --> REALTIME
    PRISMA --> PG
    REALTIME -->|Real-time Events| WS
```

### System Components Flow

```mermaid
sequenceDiagram
    participant Client
    participant Gateway
    participant Guard
    participant Service
    participant Prisma
    participant Cache
    participant Realtime
    participant Socket

    Client->>Gateway: HTTP Request + JWT + x-tenant-id
    Gateway->>Guard: JwtAuthGuard
    Guard->>Guard: Validate JWT Token
    Guard->>Guard: TenantGuard (Check Membership)
    Guard->>Service: Request Authorized
    Service->>Cache: Check Cache (First Page)
    alt Cache Hit
        Cache-->>Service: Return Cached Data
    else Cache Miss
        Service->>Prisma: Database Query (tenant_id scoped)
        Prisma-->>Service: Query Results
        Service->>Cache: Store in Cache
    end
    Service->>Realtime: Emit Event (if mutation)
    Realtime->>Socket: Broadcast to Room
    Socket-->>Client: Real-time Update (WebSocket)
    Service-->>Gateway: Response
    Gateway-->>Client: JSON Response
```

### Key Design Decisions

1. **Multi-Tenancy Strategy: Row-Level Security**
   - **Why**: Chosen over schema-based multi-tenancy for simplicity and easier operations (single schema, single connection pool)
   - **Implementation**: Every tenant-scoped table (Board, Todo) includes `tenant_id` column
   - **Enforcement**: All service layer queries explicitly filter by `tenant_id`; TenantGuard verifies membership on every request
   - **Future**: Can be enhanced with PostgreSQL Row Level Security (RLS) for defense-in-depth

2. **Authentication: Stateless JWT**
   - **Why**: Stateless authentication simplifies horizontal scaling and removes the need for session storage
   - **Implementation**: JWT tokens contain user ID (`sub` claim); tokens verified on every request via Passport JWT strategy
   - **Security**: Tokens are short-lived (configurable expiry); passwords hashed with bcrypt

3. **Tenant Context: Header-Based**
   - **Why**: Allows users to belong to multiple tenants and switch context without re-authentication
   - **Implementation**: `x-tenant-id` header specifies active tenant; verified by TenantGuard on every request
   - **Alternative Considered**: Subdomain-based routing (more complex, requires DNS configuration)

4. **Real-Time: Socket.IO Rooms**
   - **Why**: Room-based architecture allows efficient event distribution (only interested clients receive events)
   - **Implementation**: Room naming `${tenantId}:${boardId}` ensures tenant isolation by design
   - **Scalability**: Can add Redis adapter for multi-instance deployments (not required for MVP)

5. **API Design: RESTful with Versioning**
   - **Why**: REST is familiar, well-understood, and easy to document; versioning (`/v1/`) allows future breaking changes
   - **Implementation**: Resource-based URLs (`/tenants/:tenantId/boards/:boardId/todos`); standard HTTP methods
   - **Documentation**: Swagger/OpenAPI at `/docs` endpoint

6. **Validation: DTOs with class-validator**
   - **Why**: Type-safe, declarative validation at the API boundary prevents invalid data from reaching business logic
   - **Implementation**: All request DTOs use decorators (`@IsString()`, `@MinLength()`, etc.); ValidationPipe enforces globally

7. **Error Handling: Centralized Exception Filter**
   - **Why**: Consistent error responses improve client experience and simplify error handling
   - **Implementation**: HttpExceptionFilter catches all exceptions, transforms to consistent JSON format, hides internal details

8. **Testing Strategy: Unit + Integration**
   - **Why**: Unit tests verify business logic isolation; integration tests verify database interactions
   - **Implementation**: Jest for testing; mocked Prisma client in unit tests; real database in integration tests
   - **Coverage**: Core services (Auth, Tenants, Boards, Todos) and guards have unit tests

9. **Frontend: React with Optimistic Updates**
   - **Why**: Optimistic updates provide instant feedback while real-time events ensure eventual consistency
   - **Implementation**: UI updates immediately on user action; Socket.IO events reconcile state across clients

## Multi‑Tenancy Strategy
- Single schema; every tenant‑scoped table includes `tenant_id`
- All queries include `tenant_id` constraint; never fetch by raw `id` alone
- `user_tenants` join table; membership checked on each request
- Socket connections authenticated and bound to rooms `${tenantId}:${boardId}`
- Future: document path to Postgres/Supabase RLS for defense‑in‑depth

### Database Schema

```mermaid
erDiagram
    User ||--o{ UserTenant : "belongs to"
    Tenant ||--o{ UserTenant : "has members"
    Tenant ||--o{ Board : "contains"
    Board ||--o{ Todo : "contains"
    User ||--o{ Todo : "assigned to"

    User {
        string id PK "CUID"
        string email UK "Unique"
        string passwordHash "Bcrypt"
        datetime createdAt
        datetime updatedAt
    }

    Tenant {
        string id PK "CUID"
        string name
        datetime createdAt
        datetime updatedAt
    }

    UserTenant {
        string userId FK
        string tenantId FK
        string role "member/owner"
        datetime createdAt
        datetime updatedAt
    }

    Board {
        string id PK "CUID"
        string tenantId FK "Multi-tenant scoping"
        string name
        datetime createdAt
        datetime updatedAt
    }

    Todo {
        string id PK "CUID"
        string tenantId FK "Multi-tenant scoping"
        string boardId FK
        string title
        string description
        string status "TODO/IN_PROGRESS/DONE"
        string assigneeUserId FK "Nullable"
        datetime createdAt
        datetime updatedAt
    }
```

**Key Design Points:**
- **Tenant Isolation**: `tenant_id` on Board and Todo ensures data segregation
- **Composite Keys**: `UserTenant` uses composite primary key `(userId, tenantId)` for fast membership lookups
- **Indexes**: Added on `tenant_id`, `board_id`, and composite keys for query performance
- **Cascade Deletes**: Deleting a tenant cascades to boards and todos automatically

## How Real-Time Updates Are Implemented

### Architecture Overview

Real-time collaboration is implemented using **Socket.IO** via NestJS WebSocket Gateway. The system uses a room-based architecture for efficient event distribution and strict tenant isolation.

### Real-Time Collaboration Flow

```mermaid
sequenceDiagram
    participant Alice
    participant Bob
    participant SocketIO
    participant Gateway
    participant Service
    participant Database

    Note over Alice,Bob: Both users connect to Socket.IO
    
    Alice->>SocketIO: Connect (JWT + x-tenant-id: acme-corp)
    Bob->>SocketIO: Connect (JWT + x-tenant-id: acme-corp)
    
    SocketIO->>Gateway: Authenticate & Validate Tenant
    Gateway->>Gateway: Join Room: "acme-corp:boards"
    
    Note over Alice,Bob: Both users open the same board
    
    Alice->>SocketIO: join_board {boardId: website-launch}
    Bob->>SocketIO: join_board {boardId: website-launch}
    SocketIO->>Gateway: Join Room: "acme-corp:website-launch"
    
    Note over Alice: Alice creates a new todo
    
    Alice->>Service: POST /todos (Create "Deploy to production")
    Service->>Database: Insert Todo (tenant_id scoped)
    Database-->>Service: Todo Created
    Service->>Gateway: Emit "todo.created" to "acme-corp:website-launch"
    Gateway->>SocketIO: Broadcast to Room
    SocketIO->>Alice: todo.created Event (Confirmation)
    SocketIO->>Bob: todo.created Event (Real-time Update)
    Bob->>Bob: Update UI (New todo appears instantly)
```

### Room Structure & Event Routing

```mermaid
graph TB
    subgraph "Socket.IO Rooms"
        TR["Tenant Room<br/>tenant-123:boards"]
        BR1["Board Room 1<br/>tenant-123:board-456"]
        BR2["Board Room 2<br/>tenant-123:board-789"]
    end

    subgraph "Events"
        BE["Board Events<br/>board.created<br/>board.updated<br/>board.deleted"]
        TE["Todo Events<br/>todo.created<br/>todo.updated<br/>todo.deleted"]
    end

    subgraph "Clients"
        C1["Alice<br/>Member of tenant-123"]
        C2["Bob<br/>Member of tenant-123"]
        C3["Charlie<br/>Member of tenant-456"]
    end

    C1 -->|"Auto-join"| TR
    C2 -->|"Auto-join"| TR
    C1 -->|"Explicit join"| BR1
    C2 -->|"Explicit join"| BR1
    C1 -->|"Explicit join"| BR2

    BE -->|"Broadcast to"| TR
    TE -->|"Broadcast to"| BR1
    TE -->|"Broadcast to"| BR2

    style TR fill:#e1f5ff
    style BR1 fill:#fff4e1
    style BR2 fill:#fff4e1
    style BE fill:#e8f5e9
    style TE fill:#fce4ec
```

**Room Behavior:**
- **Tenant Room (`tenant-123:boards`)**: Alice & Bob automatically join on connection. They receive all board-level events.
- **Board Room 1 (`tenant-123:board-456`)**: Only Alice & Bob (explicitly joined) receive todo events for board-456.
- **Board Room 2 (`tenant-123:board-789`)**: Only Alice (explicitly joined) receives todo events for board-789.
- **Security**: Charlie cannot join tenant-123 rooms (tenant isolation enforced).

### Implementation Details

1. **Connection & Authentication:**
   - Clients connect to the Socket.IO server with a JWT token in the handshake (`auth.token`)
   - The `x-tenant-id` header is required to bind the connection to a specific tenant
   - Upon connection, the gateway:
     - Validates the JWT token
     - Extracts the user ID from the token payload
     - Verifies the tenant ID is provided
     - Automatically joins the tenant-wide boards room: `${tenantId}:boards`

2. **Room Structure:**
   - **Tenant-wide room**: `${tenantId}:boards` - All tenant members automatically join this room on connection. Used for board-level events (`board.created`, `board.updated`, `board.deleted`)
   - **Board-specific room**: `${tenantId}:${boardId}` - Clients explicitly join this room via `join_board` event when viewing a specific board. Used for todo-level events (`todo.created`, `todo.updated`, `todo.deleted`)

3. **Event Broadcasting:**
   - When a user performs a CRUD operation (create/update/delete) on a board or todo, the corresponding service emits an event via `RealtimeService`
   - Board events are broadcast to `${tenantId}:boards` room (affects board list)
   - Todo events are broadcast to `${tenantId}:${boardId}` room (affects todos in that board)
   - Only clients in the appropriate room receive the events

4. **Frontend Integration:**
   - The React frontend uses `socket.io-client` to connect to the backend
   - On connection, the frontend automatically subscribes to tenant-wide board events
   - When a user opens a board, the frontend emits `join_board` to receive todo-level updates
   - Event listeners update the React state immediately, providing instant UI updates without page refresh
   - **Optimistic UI updates** are implemented - the UI updates immediately on user action, then real-time events ensure consistency across all clients

5. **Security & Isolation:**
   - JWT authentication ensures only authenticated users can connect
   - Tenant isolation is enforced at the room level - users can only join rooms for tenants they belong to
   - Room naming convention (`${tenantId}:${boardId}`) prevents cross-tenant data leakage
   - Server-side validation ensures users can only access tenant-scoped resources

### Authentication & Authorization Flow

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant AuthService
    participant TenantGuard
    participant TenantService
    participant Database

    Note over Client: User Login Flow
    
    Client->>API: POST /auth/login {email, password}
    API->>AuthService: login(email, password)
    AuthService->>Database: Find User by Email
    Database-->>AuthService: User Data
    AuthService->>AuthService: Verify Password (bcrypt)
    AuthService->>AuthService: Generate JWT Token
    AuthService-->>API: {token, userId}
    API-->>Client: JWT Token

    Note over Client: Authenticated Request Flow
    
    Client->>API: GET /tenants/:tenantId/boards<br/>Headers: Authorization, x-tenant-id
    API->>TenantGuard: Check Request
    TenantGuard->>TenantGuard: Extract JWT from Header
    TenantGuard->>AuthService: Validate JWT Token
    AuthService-->>TenantGuard: User ID from Token
    TenantGuard->>TenantService: isUserMemberOfTenant(userId, tenantId)
    TenantService->>Database: Check UserTenant Table
    Database-->>TenantService: Membership Result
    alt User is Member
        TenantService-->>TenantGuard: true
        TenantGuard-->>API: Request Authorized
        API->>API: Process Request (tenant-scoped)
        API-->>Client: Success Response
    else User is NOT Member
        TenantService-->>TenantGuard: false
        TenantGuard-->>Client: 403 Forbidden
    end
```

### Example Flow

**Scenario**: Alice and Bob are both members of "Acme Corp" tenant. Both open the "Website Launch" board.

1. Alice and Bob both connect to Socket.IO with their JWT tokens and `x-tenant-id: acme-corp-id`
2. Both automatically join `${acme-corp-id}:boards` room
3. When they open the "Website Launch" board, they both emit `join_board` with `boardId: website-launch-id`
4. Both join `${acme-corp-id}:website-launch-id` room
5. Alice creates a new todo "Deploy to production"
6. The backend emits `todo.created` event to `${acme-corp-id}:website-launch-id` room
7. Bob receives the event instantly and sees the new todo appear in his UI without refreshing

### Scalability Considerations

- For single-instance deployments, the current implementation works perfectly
- For multi-instance/horizontal scaling, a Redis adapter can be added to Socket.IO to enable event distribution across instances (documented in "Trade-Offs & Future Work")

## API Surface (v1, REST)
- Auth: `POST /v1/auth/signup`, `POST /v1/auth/login`, `GET /v1/me`
- Tenants: `GET /v1/tenants` (current user memberships)
- Boards: `GET/POST /v1/tenants/:tenantId/boards`, `GET /v1/tenants/:tenantId/boards/:boardId`
- Todos: `GET/POST /v1/tenants/:tenantId/boards/:boardId/todos`, `PATCH/DELETE /v1/tenants/:tenantId/todos/:todoId`
- All endpoints require JWT and enforce tenant membership + tenant‑scoped queries

## Security Considerations
- Authn: JWT (short‑lived access, optional refresh), bcrypt password hashing
- Authz: per‑request tenant membership check; resource scoping by `{ id, tenantId }`
- Validation: DTOs with class‑validator; reject malformed input
- Error model: consistent JSON, no internal leakage; audit‑friendly logs (no PII)
- CORS and basic rate limiting enabled in app entrypoint

## Project Structure

```
Carsu/
├── apps/
│   ├── api/                    # NestJS backend
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/       # Authentication (signup/login/JWT)
│   │   │   │   ├── tenants/    # Tenant membership & guards
│   │   │   │   ├── boards/     # Board CRUD
│   │   │   │   ├── todos/      # Todo CRUD
│   │   │   │   └── realtime/   # Socket.IO gateway
│   │   │   ├── common/         # Shared utilities
│   │   │   │   ├── decorators/ # Custom decorators (@CurrentUser, @ActiveTenant)
│   │   │   │   ├── filters/    # Exception filters
│   │   │   │   ├── interceptors/ # Logging interceptor
│   │   │   │   ├── pipes/      # Validation pipes
│   │   │   │   └── prisma/     # Prisma client service
│   │   │   ├── health/         # Health check endpoints
│   │   │   ├── main.ts         # Application bootstrap
│   │   │   └── app.module.ts   # Root module
│   │   ├── test/               # Unit & integration tests
│   │   ├── prisma/
│   │   │   ├── schema.prisma   # Database schema
│   │   │   └── migrations/     # Database migrations
│   │   ├── Dockerfile
│   │   └── package.json
│   └── web/                    # React frontend
│       ├── src/
│       │   ├── lib/
│       │   │   ├── api.ts      # API client
│       │   │   └── socket.ts   # Socket.IO client
│       │   ├── ui/
│       │   │   └── App.tsx     # Main application component
│       │   ├── main.tsx
│       │   └── styles.css
│       ├── Dockerfile
│       └── package.json
├── scripts/
│   └── dev.sh                  # Development setup script
├── setup.sh                    # One-command automated setup script
├── Makefile                    # Convenient Make commands
├── docker-compose.yml          # Docker orchestration
├── pnpm-workspace.yaml         # pnpm monorepo config
├── README.md                   # This file
└── .gitignore
```

## How to Run the App

### Prerequisites
- Docker (with Docker Compose v2 or v1 - automatically detected)
- Node.js 20+ (optional, if running locally without Docker)
- pnpm 9+ (optional, if running locally)

### Quick Start - One Command Setup (Recommended)

The easiest way to get started is using our automated setup script or Makefile. Both detect Docker Compose version automatically and handle everything for you.

#### Option A: Using the Setup Script
```bash
git clone https://github.com/sassihamdi-CD/Carsu.git
cd Carsu
./setup.sh
```

#### Option B: Using Make (Even Simpler)
```bash
git clone https://github.com/sassihamdi-CD/Carsu.git
cd Carsu
make setup
```

**That's it!** The script will:
-  Clean up any existing containers
-  Build and start all services (database, API, frontend)
-  Wait for database to be healthy
-  Run Prisma migrations automatically
-  Verify API and frontend are ready
-  Display access URLs and useful commands

### Access the Application

Once setup completes, access:
- **Frontend**: http://localhost:5174
- **API**: http://localhost:4000
- **API Documentation (Swagger)**: http://localhost:4000/docs
- **Health Check**: http://localhost:4000/v1/health

### Useful Commands

Using **Make** (recommended):
```bash
make help      # Show all available commands
make setup     # Complete setup (build, start, migrate, verify)
make start     # Start all services
make stop      # Stop all services
make restart   # Restart all services
make logs      # View all logs (follow mode)
make api-logs  # View API logs only
make web-logs  # View frontend logs only
make db-logs   # View database logs only
make clean     # Stop and remove everything (containers, volumes)
make test      # Run API tests
make status    # Show service status
```

Or using **Docker Compose directly**:
```bash
# View logs
docker compose logs -f    # or: docker-compose logs -f (v1)

# Stop services
docker compose down       # or: docker-compose down (v1)

# Restart services
docker compose restart    # or: docker-compose restart (v1)
```

### Option 2: Manual Setup (Advanced)

If you prefer manual control:

1. **Clone the repository:**
```bash
git clone https://github.com/sassihamdi-CD/Carsu.git
cd Carsu
```

2. **Start all services:**
```bash
# Detects docker compose v2 or docker-compose v1 automatically
docker compose up -d --build
# Or: docker-compose up -d --build
```

3. **Run database migrations:**
```bash
# Wait for database to be ready, then:
docker compose exec api sh -c "cd /app/apps/api && npx prisma migrate deploy"
# Or: docker-compose exec api sh -c "cd /app/apps/api && npx prisma migrate deploy"
```

4. **Access the application:**
- **Frontend**: http://localhost:5174
- **API**: http://localhost:4000
- **API Documentation (Swagger)**: http://localhost:4000/docs
- **Health Check**: http://localhost:4000/v1/health

5. **View logs:**
```bash
docker compose logs -f    # or: docker-compose logs -f
```

6. **Stop services:**
```bash
docker compose down    # or: docker-compose down
# To remove volumes (database data):
docker compose down -v    # or: docker-compose down -v
```

### Option 3: Local Development (Without Docker)

1. **Install dependencies:**
```bash
pnpm install
```

2. **Start PostgreSQL** (ensure it's running on port 5433, or update `DATABASE_URL` in `apps/api/.env`)

3. **Setup database:**
```bash
cd apps/api
npx prisma generate
npx prisma migrate dev
```

4. **Create environment file:**
```bash
# apps/api/.env
DATABASE_URL="postgresql://carsu:carsu@localhost:5433/carsu?schema=public"
JWT_SECRET="dev_jwt_secret_change_me"
PORT=3000
NODE_ENV=development
```

5. **Start backend:**
```bash
cd apps/api
pnpm run start:dev
```

6. **Start frontend** (in another terminal):
```bash
cd apps/web
pnpm run dev
```

Access the frontend at http://localhost:5173

## Testing

### Unit Tests
- **Location**: `apps/api/test/`
- **Coverage**: Core services (Auth, Tenants, Boards, Todos, Realtime), guards, and decorators
- **Run**: `cd apps/api && pnpm test`
- **Watch mode**: `pnpm test:watch`
- **Coverage report**: `pnpm test:cov`

### Integration Tests
- **Location**: `apps/api/test/` (end-to-end tests)
- **Coverage**: API endpoints with real database
- **Run**: `cd apps/api && pnpm test:e2e`

### Test Examples
- Authentication flow (signup, login, JWT validation)
- Tenant membership checks
- Board CRUD with tenant isolation
- Todo CRUD with tenant and board scoping
- Real-time event emission and room management

### CI/CD
- **Status**: Implemented via GitHub Actions
- **Workflow**: `.github/workflows/ci.yml`
- **Runs on**: Push and pull requests to `main`/`develop` branches
- **Jobs**:
  - **Lint & Type Check**: Runs ESLint and TypeScript type checking for API and Web
  - **Test API**: Runs unit tests with PostgreSQL service container, generates coverage reports
- **Coverage**: Codecov integration for coverage tracking (optional)

## Delivery Plan (Commits Order)
1. docs: enrich README with architecture, scope, and plan (this commit)
2. chore: scaffold repository structure (folders, no implementation)
3. chore: tooling (pnpm, ESLint/Prettier, Jest config, @nestjs/config)
4. feat: bootstrap NestJS app and config
5. chore: Prisma schema + migrations
6. feat: auth (signup/login), guards, DTOs
7. feat: tenants, boards, todos with tenant enforcement
8. feat: realtime gateway and broadcasts
9. test: add unit/integration/e2e; ci: GitHub Actions
10. docs: finalize README (run, demo, trade‑offs, future work)

## Trade‑Offs & Things to Improve with More Time

### Current Trade‑Offs

1. **Multi-Tenancy: Application-Level Enforcement**
   - **Current**: Tenant isolation enforced at application layer (service queries filter by `tenant_id`)
   - **Trade-off**: Requires discipline in code reviews; single bug could expose cross-tenant data
   - **Future**: Add PostgreSQL Row Level Security (RLS) for defense-in-depth at the database level

2. **Real-Time: Single-Instance Socket.IO**
   - **Current**: Socket.IO in-memory adapter (works for single server)
   - **Trade-off**: Won't scale horizontally without Redis adapter
   - **Future**: Add Redis adapter for Socket.IO to enable multi-instance deployments

3. **Authorization: Basic Role System**
   - **Current**: Simple membership check (user is member of tenant or not)
   - **Trade-off**: All members have same permissions; no fine-grained access control
   - **Future**: Implement RBAC (owner/admin/member roles) with per-board permissions

4. **Pagination: Cursor-Based Only**
   - **Current**: Cursor-based pagination for boards and todos
   - **Trade-off**: No offset-based pagination; can't jump to specific pages
   - **Future**: Add offset pagination option; implement filtering and sorting

5. **Caching: First-Page Only**
   - **Current**: First page of boards/todos is cached for 60 seconds
   - **Trade-off**: Subsequent pages are not cached; cache invalidation is simple but may miss edge cases
   - **Future**: Implement more sophisticated caching strategy with Redis; add cache warming

6. **Error Messages: Generic for Security**
   - **Current**: Error messages don't reveal whether a resource exists or user lacks permission (prevents enumeration attacks)
   - **Trade-off**: Less helpful error messages for debugging
   - **Future**: Log detailed errors server-side; return generic messages to clients

7. **Frontend: Minimal Error Handling**
   - **Current**: Basic error display; no retry logic or offline support
   - **Trade-off**: Network failures require manual retry
   - **Future**: Add retry logic with exponential backoff; implement offline queue

### Improvements for Production

1. **Security Enhancements:**
   - Add rate limiting per user/tenant (currently global)
   - Implement refresh token rotation
   - Add CSRF protection for state-changing operations
   - Implement input sanitization to prevent XSS
   - Add security headers (helmet is configured, but can be more restrictive)

2. **Observability:**
   - Add structured logging with correlation IDs
   - Implement distributed tracing (e.g., OpenTelemetry)
   - Add metrics collection (Prometheus/Grafana)
   - Set up alerting for errors and performance degradation

3. **Performance:**
   - Add database query optimization and connection pooling tuning
   - Implement CDN for frontend static assets
   - Add API response compression
   - Optimize Prisma queries (N+1 prevention, query batching)

4. **Testing:**
   - Add end-to-end tests with Playwright/Cypress
   - Increase unit test coverage to >80%
   - Add load testing with k6 or Artillery
   - Test multi-instance Socket.IO with Redis adapter

5. **Documentation:**
   - Add API usage examples and common workflows
   - Document deployment procedures for different environments
   - Add architecture decision records (ADRs)
   - Create developer onboarding guide

6. **CI/CD:**
   - Set up GitHub Actions workflow for automated testing
   - Add automated dependency updates (Dependabot)
   - Implement automated security scanning
   - Add deployment pipelines for staging/production

7. **Database:**
   - Add database migrations rollback strategy
   - Implement database backup and recovery procedures
   - Add database monitoring and slow query logging
   - Consider read replicas for scaling reads

---

Repo: https://github.com/sassihamdi-CD/Carsu
