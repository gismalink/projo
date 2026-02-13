# Projo MVP

MVP foundation for project planning app (API + Web + Postgres).

## Stack
- API: NestJS + Prisma + PostgreSQL + JWT RBAC
- Web: React + Vite + TypeScript
- Infra: Docker Compose (PostgreSQL)

## Quick start
1. Copy env files:
   - `cp .env.example .env`
   - `cp apps/api/.env.example apps/api/.env`
   - `cp apps/web/.env.example apps/web/.env`
2. Start database:
   - `docker compose up -d`
3. Install dependencies:
   - `npm install`
4. Generate prisma client and migrate:
   - `npm run prisma:generate -w @projo/api`
   - `npm run prisma:migrate -w @projo/api`
5. Start apps:
   - API: `npm run dev:api`
   - Web: `npm run dev:web`

## API endpoints (MVP slice)
- `POST /api/auth/login`
- `GET /api/health`
- `GET/POST/PATCH/DELETE /api/roles`
- `GET/POST/PATCH/DELETE /api/employees`
- `GET/POST/PATCH/DELETE /api/projects`
- `GET/POST/PATCH/DELETE /api/assignments`
- `GET /api/timeline/year?year=YYYY`

## Default bootstrap admin
- email: `admin@projo.local`
- password: `admin12345`

Created automatically on API startup if not found.

## UI features in this build
- Login screen with bootstrap admin.
- Directory tab: roles and employees.
- Timeline tab: project quick-create form and yearly gantt-like bars.

## Next steps
- Add assignments creation UI and project details drawer.
- Implement conflict detection (overload + vacation overlap).
- Add tests (unit + integration + e2e).
