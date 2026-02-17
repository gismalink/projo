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
- Уровень агрегации стартового экрана — планы (project spaces / workspaces), внутри которых хранятся timeline-проекты.

## 3) Backend architecture (`apps/api`)
- Entry: `src/main.ts` -> `src/app.module.ts`.
- Cross-cutting:
  - Prisma integration: `src/common/prisma.*`
  - JWT + RBAC: `src/auth/*`, `src/common/decorators/roles.decorator.ts`, `src/common/guards/roles.guard.ts`
  - Error code map: `src/common/error-codes.ts`
- Domain modules:
  - `roles`, `skills`, `departments`, `employees`, `vacations`, `cost-rates`, `team-templates`, `projects`, `assignments`, `timeline`, `calendar`, `health`.
- Common backend pattern: `controller -> service -> prisma`.

## 4) Data model highlights (Prisma)
- `Role`: supports `shortName` and `colorHex` for compact/visual UI representation.
- `Department`: supports `colorHex` and is linked to employees.
- `Employee`: linked to role and optional department; has grade/status/capacity.
- `Project`:
  - optional binding to `ProjectTeamTemplate` via `teamTemplateId`,
  - `ProjectMember` keeps membership list,
  - `ProjectAssignment` keeps timeline allocation periods.
- `Workspace` (project space) — контейнер плана для изоляции операционных расчетов (`timeline/assignments/vacations/cost-rates`) на уровне активного плана.
- Сотрудники используются как owner-scoped shared team между планами одного владельца (без дублирования записей при создании нового плана).
- `ProjectTeamTemplate` + `ProjectTeamTemplateRole`: настраиваемые шаблоны обязательного состава проекта.
- `Vacation`: employee absences.
- `CostRate`: role/employee rates with validity interval.
- `CalendarDay` + `CalendarYearSync`: production calendar cache and sync health.

## 5) Frontend architecture (`apps/web`)
- Root composition: `src/pages/App.tsx`.
- App logic split:
  - state: `src/hooks/useAppState.ts`
  - derived selectors: `src/hooks/useAppDerivedData.ts`
  - async handlers facade/composition: `src/hooks/useAppHandlers.ts`
  - async handlers by domain: `src/hooks/handlers/*`
    - `auth.handlers.ts` (login/bootstrap)
    - `personnel.handlers.ts` (roles, skills, employees, vacations, departments, templates)
    - `projects.handlers.ts` (project create/edit/select/order)
    - `assignments.handlers.ts` (assignment create/edit/delete/plan updates)
    - `timeline.handlers.ts` (year switching + project timeline plan adjustments)
  - facade: `src/hooks/useAppData.ts`
- Shared frontend utilities and constants:
  - constants: `src/constants/app.constants.ts`, `src/constants/seed-defaults.constants.ts`
  - timeline date helpers: `src/components/timeline/timeline-date.utils.ts`
  - salary helpers: `src/hooks/salary.utils.ts`
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
- Stabilization/technical audits: `docs/stabilization-audit-2026-02-15.md`, `docs/technical-audit-2026-02-16.md`.

## 7) Domain invariants: ProjectMember vs ProjectAssignment
- `ProjectAssignment` хранит фактическое планирование сотрудника в проекте (даты/нагрузка) и является источником данных для Timeline.
- `ProjectMember` хранит membership-пул сотрудников проекта и используется для операций управления составом.
- При создании/обновлении assignment backend гарантирует наличие пары `projectId + employeeId` в `ProjectMember` (auto-upsert member).
- На текущем этапе действует ограничение: в одном проекте на одного сотрудника допускается только один assignment (уникальность `@@unique([projectId, employeeId])`).
- Удаление assignment не удаляет member автоматически.
- Удаление member не удаляет assignment автоматически; при следующем create/update assignment member будет восстановлен backend-логикой.
- Смещение дат проекта не триггерит принудительный cascade в API-слое; сдвиг assignment дат выполняется отдельными операциями Timeline flow.

## 8) Aggregation levels
- Уровень 1 (текущий): **Планы** — карточки на экране «Мои планы», переключают активный tenant-контекст.
- Уровень 2 (текущий): **Проекты внутри плана** — участвуют в Timeline и расчетах загрузки.
- Будущий уровень (planned): **Компании** как надстройка над планами, где у пользователя может быть несколько независимых наборов планов.
