# Architecture Overview

## 1) Monorepo layout
- `apps/api`: NestJS backend (REST API, auth, RBAC, Prisma).
- `apps/web`: React + Vite SPA (tabs: Timeline, Team, Settings, Guide).
- `packages/shared`: shared package placeholder.
- `docs`: project documentation.
- `scripts`: workspace automation (`verify-all.sh`, API smoke test, profiling helpers).

## 2) Runtime topology
- PostgreSQL runs in Docker (host compose for test/prod: `infra/docker-compose.host.yml`).
- API runs as NestJS service with global `/api` prefix.
- Web is a Vite-built SPA served via `vite preview` in container.
- В `test/prod` внешний ingress вынесен в отдельный stack (`edge`) и маршрутизирует:
  - `https://test.projo.gismalink.art` -> `projo-web-test`, `.../api/*` -> `projo-api-test`
  - `https://projo.gismalink.art` -> `projo-web-prod`, `.../api/*` -> `projo-api-prod`
- Web calls API through `VITE_API_URL` in `apps/web/src/api/client.ts`.

Важно про Vite env:
- `VITE_*` переменные — compile-time (вшиваются в bundle на этапе `vite build`).
- Поэтому для `test/prod` значения `VITE_API_URL`, `VITE_AUTH_MODE`, `VITE_AUTH_BASE_URL` должны попадать в сборку (см. `infra/docker-compose.host.yml` -> `build.args`).

## 3) Backend architecture (`apps/api`)
- Entry: `src/main.ts` -> `src/app.module.ts`.
- Cross-cutting:
  - Prisma integration: `src/common/prisma.*`
  - JWT + RBAC: `src/auth/*`, `src/common/decorators/roles.decorator.ts`, `src/common/guards/roles.guard.ts`
  - SSO proxy endpoints (central auth): `src/auth/sso.controller.ts`
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
- Сотрудники используются как shared team в рамках компании (company-scoped), без пересечений между компаниями.
- Компания может иметь 0 видимых планов: используется скрытый "company home workspace" (не показывается в списке планов).
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
  - cost/salary logic lives in API (`CostRate`) and is surfaced via project cost summary.
- Components by domain: `src/components/personnel`, `src/components/roles`, `src/components/timeline`, `src/components/modals`.
- i18n dictionaries: `src/pages/app-i18n.ts` (`ru`/`en`).
- Styles are split by domain with Sass partials and unified entrypoint:
  - `src/styles/index.scss`
  - `src/styles/global.scss`
  - `src/styles/_header.scss`
  - `src/styles/_forms.scss`
  - `src/styles/personnel.scss`
  - `src/styles/roles.scss`
  - `src/styles/timeline.scss`
  - `src/styles/modals.scss`

## 6) Related docs
- Product behavior, user flows and business rules: `docs/product-spec.md`.
- API endpoints and contracts: `docs/api-reference.md`.
- Run/start instructions: `README.md`.
- Delivery workflow and checks: `docs/workflow-checklist.md`.
- Stabilization/technical audits: `docs/audits/stabilization-audit-2026-02-15.md`, `docs/audits/technical-audit-2026-02-16.md`, `docs/audits/technical-audit-2026-02-18.md`.

## 7) Domain invariants: ProjectMember vs ProjectAssignment
- `ProjectAssignment` хранит фактическое планирование сотрудника в проекте (даты/нагрузка) и является источником данных для Timeline.
- `ProjectMember` хранит membership-пул сотрудников проекта и используется для операций управления составом.
- При создании/обновлении assignment backend гарантирует наличие пары `projectId + employeeId` в `ProjectMember` (auto-upsert member).
- На текущем этапе действует ограничение: в одном проекте на одного сотрудника допускается только один assignment (уникальность `@@unique([projectId, employeeId])`).
- Удаление assignment не удаляет member автоматически.
- Удаление member не удаляет assignment автоматически; при следующем create/update assignment member будет восстановлен backend-логикой.
- Смещение дат проекта не триггерит принудительный cascade в API-слое; сдвиг assignment дат выполняется отдельными операциями Timeline flow.
- Assignment может выходить за плановые даты проекта; это не блокируется API и подсвечивается как диагностическая ошибка `fact-range` на Timeline.

## 8) Aggregation levels
- Уровень 1: **Компании** — независимые tenant-контексты (roles/departments/grades/team templates и список планов).
- Уровень 2: **Планы (workspaces / project spaces)** — карточки на экране «Мои планы» внутри выбранной компании.
- Уровень 3: **Проекты внутри плана** — участвуют в Timeline и расчетах.
