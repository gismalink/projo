# Architecture Overview

## 1. Monorepo layout
- `apps/api`: NestJS backend (REST API, auth/RBAC, domain modules, Prisma integration).
- `apps/web`: React + Vite frontend (single-page UI with tab-based workflows).
- `packages/shared`: placeholder for shared contracts/helpers (currently minimal).
- `docs`: product/implementation notes.

## 2. Runtime topology
- PostgreSQL runs in Docker (`docker-compose.yml`).
- API runs on NestJS and connects to Postgres through Prisma.
- Web app talks to API via `VITE_API_URL` (`apps/web/src/api/client.ts`).

## 3. Backend architecture (`apps/api`)
- Entry: `apps/api/src/main.ts` -> `AppModule` (`apps/api/src/app.module.ts`).
- Cross-cutting:
  - Prisma: `apps/api/src/common/prisma.service.ts`
  - RBAC decorators/guards: `apps/api/src/common/decorators/roles.decorator.ts`, `apps/api/src/common/guards/roles.guard.ts`
  - Error codes: `apps/api/src/common/error-codes.ts`
- Auth:
  - `auth` module (`/auth/login`, JWT strategy + guard).
  - Bootstrap admin user created via `users` service.
- Domain modules:
  - `roles`, `skills`, `departments`, `employees`, `vacations`, `projects`, `assignments`, `timeline`.
  - Pattern: `controller -> service -> Prisma`.

## 4. Data model (Prisma)
- Core entities:
  - `Employee` linked to `Role` and optional `Department`.
  - `Project` with `ProjectAssignment` rows.
  - `Vacation` for employee time off.
  - `Skill` with many-to-many bridge `EmployeeSkill`.
- Business rules (enforced in services):
  - one employee can appear only once per project (`@@unique([projectId, employeeId])` + service-level guard),
  - assignment date range must be valid (`start <= end`),
  - overload >100% and overlap with vacation are treated as UI soft warnings (no hard-block on create/update),
  - assignment dates outside project range are allowed for iterative planning shifts.

## 5. Frontend architecture (`apps/web`)
- API layer: `apps/web/src/api/client.ts`.
- Page composition:
  - `apps/web/src/pages/App.tsx` is thin composition/root orchestration.
  - Presentational tabs/components in `apps/web/src/components/*`.
- State/logic split:
  - `apps/web/src/hooks/useAppState.ts`: source-of-truth local state.
  - `apps/web/src/hooks/useAppDerivedData.ts`: memoized selectors.
  - `apps/web/src/hooks/useAppHandlers.ts`: async handlers and side effects.
  - `apps/web/src/hooks/useAppData.ts`: composition facade for `App.tsx`.
- i18n dictionaries:
  - `apps/web/src/pages/app-i18n.ts` (`ru`/`en` text + error mappings).
- Timeline interaction notes:
  - manual project-row ordering is stored in client state (`timelineOrder`),
  - planned bar supports drag move/resize with window-level mouse tracking,
  - move-drag is bounded by year edges (no secondary drift after hitting left/right boundary),
  - post-drop optimistic preview prevents one-frame rollback before API refresh,
  - custom tooltip for planned bar works on hover and drag (edge: single boundary date, center: range),
  - project card expand/collapse is controlled only by dedicated toggle button.

## 6. Automation and quality gates
- Workspace scripts:
  - `npm run lint`
  - `npm run test`
  - `npm run build`
- Unified verification command:
  - `npm run verify` (runs lint -> test -> build via `scripts/verify-all.sh`)
  - alias: `npm run ci:check`

## 7. Suggested onboarding flow
1. Start DB: `docker compose up -d`
2. Install deps: `npm install`
3. Prisma generate/migrate: `npm run prisma:generate -w @projo/api` and `npm run prisma:migrate -w @projo/api`
4. Start apps: `npm run dev:all`
5. Validate: `npm run verify`
