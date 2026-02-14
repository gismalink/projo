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
6. Run full verification:
   - `npm run verify`

## Architecture
- Quick architecture map: `docs/architecture-overview.md`
- Delivery checklist: `docs/workflow-checklist.md`

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
- Personnel tab: role-tag filters with counts, employee cards grouped by departments, yearly utilization indicator.
- Roles tab: role creation and roles list.
- Roles tab: editable role colors that are reflected in employee role badges.
- Timeline tab: yearly gantt-like planning with draggable `planned` project bar (move/resize), employee strips, and company-load overview.
- Timeline tab: project-row controls in header (`↑/↓/▾`) with manual ordering (no auto-sort jump).
- Project Card: expands only by dedicated toggle button and supports assignment dates/allocation editing.
- UI localization switch: `RU/EN`.
- Errors are shown as toast notifications at the bottom of the screen.

## Business rules already enforced
- One employee cannot be assigned twice to the same project.
- Assignment date range must be valid (`start <= end`).
- Overload and vacation overlap are soft warnings in timeline UI (without hard API block).
- Assignment dates outside project range are allowed for iterative planning.

## Next steps
- Implement cost engine (planned project cost by rates).
- Add reports/export and tests (unit + integration + e2e).
- Add CSV import for employees.
