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

## High‑Level Architecture
- Layered and modular NestJS app: feature modules for `auth`, `tenants`, `boards`, `todos`, `realtime`
- Guards for auth and tenant membership; DTOs for request validation
- Services encapsulate business rules; repositories use Prisma with enforced tenant scoping
- Global validation pipe and exception filter for consistent responses
- Stateless JWT auth; active tenant supplied via header and verified on every request

## Multi‑Tenancy Strategy
- Single schema; every tenant‑scoped table includes `tenant_id`
- All queries include `tenant_id` constraint; never fetch by raw `id` alone
- `user_tenants` join table; membership checked on each request
- Socket connections authenticated and bound to rooms `${tenantId}:${boardId}`
- Future: document path to Postgres/Supabase RLS for defense‑in‑depth

## Real‑Time Collaboration
- NestJS Gateway (Socket.IO)
- Authenticate on handshake; verify tenant; join `${tenantId}:${boardId}`
- On todo CRUD, broadcast `todo.created|updated|deleted` to the room
- Scales horizontally with Redis adapter (not required for this scope)

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

## Project Structure (planned)
```
/apps
  /api
    /src
      /modules
        /auth        # signup/login, JWT, guards
        /tenants     # membership, tenant guard
        /boards      # board CRUD (tenant‑scoped)
        /todos       # todo CRUD (tenant + board‑scoped)
        /realtime    # gateway + Socket.IO rooms
      /common        # filters, interceptors, pipes, decorators
      /prisma        # prisma client wrapper (optional repository)
      main.ts, app.module.ts
    /test            # unit + integration + e2e
/prisma
  schema.prisma
.docker-compose.yml
```

## Local Setup
Prereqs: Docker, Node 20+, pnpm 9+

1) Clone and install deps (will follow after scaffolding):
```
pnpm install
```
2) Start services:
```
docker-compose up -d
```
3) Database:
```
pnpm prisma:migrate
pnpm prisma:seed   # optional
```
4) Run API:
```
pnpm dev
```

Detailed commands will be added as scripts in `package.json` during implementation.

## Testing & CI
- Jest unit and integration tests (Supertest)
- Socket e2e test for real‑time event delivery
- GitHub Actions workflow to run lint, typecheck, and tests on push

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

## Trade‑Offs & Future Work
- Single‑schema enforcement now; move to RLS for ironclad isolation later
- Basic roles (membership) now; expand to RBAC per board
- Add pagination, filtering, and audit logs
- Add Redis adapter for sockets in multi‑instance deployments

---

Repo: https://github.com/sassihamdi-CD/Carsu
