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
   - Both: `npm run dev:all`
   - API only: `npm run dev:api`
   - Web only: `npm run dev:web`

## API endpoints (MVP slice)
- `POST /api/auth/login`
- `GET /api/health`
- `GET/POST/PATCH/DELETE /api/roles`
- `GET/POST/PATCH/DELETE /api/employees`
- `GET/POST/PATCH/DELETE /api/projects`
- `GET/POST/PATCH/DELETE /api/assignments`
- `GET/POST/PATCH/DELETE /api/vacations`
- `GET /api/timeline/year?year=YYYY`

## Default bootstrap admin
- email: `admin@projo.local`
- password: `admin12345`

Created automatically on API startup if not found.

## UI features in this build
- Login screen with bootstrap admin.
- Personnel tab: employees list, `Создать работника` popup, `Добавить отпуск` popup from employee row.
- Roles tab: role creation and roles list.
- Timeline tab: project quick-create form, assignment quick-create form, and yearly gantt-like bars.
- Project Card: click timeline row to inspect project assignments and edit assignment dates/allocation.

## Business rules already enforced
- Assignment dates must be inside project date range.
- Employee allocation cannot exceed 100% on any day across overlapping assignments.
- Assignment cannot overlap employee vacation period.

## Next steps
- Implement cost engine (planned project cost by rates).
- Add reports/export and tests (unit + integration + e2e).
- Add skills directory and CSV import for employees.
- Add tests (unit + integration + e2e).
