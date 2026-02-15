# Architecture Overview

## 1) Monorepo layout
- `apps/api`: NestJS backend (REST API, auth, RBAC, Prisma).
- `apps/web`: React + Vite SPA (tabs: Timeline, Team, Settings, Guide).
- `packages/shared`: shared package placeholder.
- `docs`: project documentation.
- `scripts`: workspace automation (`verify-all.sh`, API smoke test, profiling helpers).

## 2) Runtime topology
- PostgreSQL runs in Docker (`docker-compose.yml`).
- API runs as NestJS service with global `/api` prefix.
- Web calls API through `VITE_API_URL` in `apps/web/src/api/client.ts`.

## 3) Backend architecture (`apps/api`)
- Entry: `src/main.ts` -> `src/app.module.ts`.
- Cross-cutting:
  - Prisma integration: `src/common/prisma.*`
  - JWT + RBAC: `src/auth/*`, `src/common/decorators/roles.decorator.ts`, `src/common/guards/roles.guard.ts`
  - Error code map: `src/common/error-codes.ts`
- Domain modules:
  - `roles`, `skills`, `departments`, `employees`, `vacations`, `cost-rates`, `projects`, `assignments`, `timeline`, `calendar`, `health`.
- Common backend pattern: `controller -> service -> prisma`.

## 4) Data model highlights (Prisma)
- `Role`: supports `shortName` and `colorHex` for compact/visual UI representation.
- `Department`: supports `colorHex` and is linked to employees.
- `Employee`: linked to role and optional department; has grade/status/capacity.
- `Project`:
  - `ProjectMember` keeps membership list,
  - `ProjectAssignment` keeps timeline allocation periods.
- `Vacation`: employee absences.
- `CostRate`: role/employee rates with validity interval.
- `CalendarDay` + `CalendarYearSync`: production calendar cache and sync health.

## 5) Frontend architecture (`apps/web`)
- Root composition: `src/pages/App.tsx`.
- App logic split:
  - state: `src/hooks/useAppState.ts`
  - derived selectors: `src/hooks/useAppDerivedData.ts`
  - async handlers: `src/hooks/useAppHandlers.ts`
  - facade: `src/hooks/useAppData.ts`
- Components by domain: `src/components/personnel`, `src/components/roles`, `src/components/timeline`, `src/components/modals`.
- i18n dictionaries: `src/pages/app-i18n.ts` (`ru`/`en`).
- Styles are split by domain:
  - `src/styles/global.css`
  - `src/styles/personnel.css`
  - `src/styles/roles.css`
  - `src/styles/timeline.css`
  - `src/styles/modals.css`

## 6) Related docs
- Product behavior, user flows and business rules: `docs/product-spec.md`.
- API endpoints and contracts: `docs/api-reference.md`.
- Run/start instructions: `README.md`.
- Delivery workflow and checks: `docs/workflow-checklist.md`.
