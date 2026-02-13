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

## Default bootstrap admin
- email: `admin@projo.local`
- password: `admin12345`

Created automatically on API startup if not found.

## Next steps
- Add projects and assignments modules.
- Implement timeline API and conflict detection.
- Add tests (unit + integration + e2e).
