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
- password: `ProjoAdmin!2026`

Created automatically on API startup if not found.

## UI features in this build
- Login screen with bootstrap admin.
- Team tab: employees list, `Создать работника` popup, `Добавить отпуск` popup from employee row.
- Team tab: role/department chip filters with compact labels + tooltips, department filters on separate row.
- Team tab: department management popup (`list/create/update/delete` departments).
- Team tab: yearly utilization indicator and vacation dates with locale month names.
- Roles tab: role creation and roles list.
- Roles tab: role `shortName` support (used for compact labels in Team filters and Timeline bench).
- Roles tab: editable role colors reflected in employee role badges and timeline strips.
- Timeline tab: yearly gantt-like planning with draggable `planned` project bar (move/resize), employee strips, and company-load overview.
- Timeline tab: project-row controls in header (`↑/↓/▾`) with manual ordering (no auto-sort jump).
- Timeline tab: drag is clamped by year boundaries; custom tooltip appears on hover/drag (edge date or full range).
- Timeline tab: right-side `bench` column grouped by departments with drag-and-drop employee -> project row.
- Timeline tab: bench membership uses annual utilization rule (`< 100%` for selected year).
- Project Card: expands only by dedicated toggle button and supports assignment drag/resize/delete.
- UI localization switch: `RU/EN`.
- Errors are shown as toast notifications at the bottom of the screen.

## Business rules already enforced
- One employee cannot be assigned twice to the same project.
- Assignment date range must be valid (`start <= end`).
- Overload and vacation overlap are soft warnings in timeline UI (without hard API block).
- Assignment dates outside project range are allowed for iterative planning.

## Next steps
- Implement `ProjectMember` split from `ProjectAssignment` and complete member-level DnD flow.
- Finish timeline UX-polish wave (bench layout density, initials, project-row localization, Cmd/Ctrl drag modifiers).
- Refactor Roles screen flow (create/edit via popup, autosave, remove Skills block from Roles tab UI).
- Add broader test coverage (integration + e2e) and reporting/export features.
