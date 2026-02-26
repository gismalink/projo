# API Reference

Актуально для текущей реализации `apps/api`.

## Base URL
- Локально: `http://localhost:4000`
- Глобальный префикс API: `/api`
- Итоговый base: `http://localhost:4000/api`

Для test/prod (через edge ingress):
- test: `https://test.projo.gismalink.art/api`
- prod: `https://projo.gismalink.art/api`

## Auth model
- `POST /api/auth/login` — публичный endpoint (без JWT).
- В `test/prod` local auth может быть отключен через `LOCAL_AUTH_ENABLED=false` (в этом случае `login/register` вернут 410 `ERR_AUTH_LOCAL_AUTH_DISABLED`).
- Остальные endpoints (кроме `GET /api/health`) защищены `JwtAuthGuard` + `RolesGuard`.
- Роли доступа (app-level): `ADMIN`, `EDITOR`, `VIEWER`, `FINANCE`.

## Health

### `GET /api/health`
- Auth: public
- Назначение: проверка доступности сервиса
- Response: `{ status: "ok", timestamp: string }`

## Auth

### `POST /api/auth/login`
- Auth: public
- Body: `{ email: string, password: string }`
- Response: JWT payload (token + user)
- Если `LOCAL_AUTH_ENABLED=false`: 410 `ERR_AUTH_LOCAL_AUTH_DISABLED`

### `POST /api/auth/register`
- Auth: public
- Body: `{ email: string, fullName: string, password: string }`
- Response: JWT payload (token + user)
- Если `LOCAL_AUTH_ENABLED=false`: 410 `ERR_AUTH_LOCAL_AUTH_DISABLED`

## SSO (proxy)

Эти endpoints проксируют запросы в central auth (`AUTH_SSO_BASE_URL`) и используются web-клиентом в `VITE_AUTH_MODE="sso"`.

### `GET /api/sso/get-token`
- Auth: public (но требует cookies central auth)
- Назначение: получить JWT центральной auth-сессии для последующих запросов в Projo API.
- Response: `{ authenticated: boolean, token?: string, email?: string | null, ... }`

Примечание:
- В web SSO bootstrap сначала пробует этот proxy endpoint.
- При проблемах с cookie-доставкой на домен projo, web может делать fallback прямым запросом на auth-домен: `GET https://<auth-host>/auth/get-token` с `credentials: include` (нужен корректный CORS allowlist на central auth).

### `GET /api/sso/current-user`
- Auth: public (но требует cookies central auth)
- Назначение: получить текущего пользователя из central auth (для диагностики/отладки).

### `GET /api/auth/me`
- Roles: `ADMIN | EDITOR | VIEWER | FINANCE`
- Response: текущий пользователь + активный project-context (`workspaceId`, `workspaceRole`)

### `GET /api/auth/projects`
- Roles: `ADMIN | EDITOR | VIEWER | FINANCE`
- Response: `{ activeProjectId, myProjects[], sharedProjects[] }`

### `POST /api/auth/projects`
- Roles: `ADMIN | EDITOR | VIEWER | FINANCE`
- Body: `{ name: string }`
- Назначение: создать новый project-space и сделать его активным.

### `POST /api/auth/projects/switch`
- Roles: `ADMIN | EDITOR | VIEWER | FINANCE`
- Body: `{ projectId: string }`
- Назначение: переключить активный project-space пользователя.

### `GET /api/auth/companies`
- Roles: `ADMIN | EDITOR | VIEWER | FINANCE`
- Response: `{ activeCompanyId, companies[] }`

### `POST /api/auth/companies`
- Roles: `ADMIN | EDITOR | VIEWER | FINANCE`
- Body: `{ name: string }`
- Назначение: создать компанию и сделать её активной.

### `PATCH /api/auth/companies/:companyId`
- Roles: `ADMIN | EDITOR | VIEWER | FINANCE`
- Body: `{ name: string }`
- Назначение: owner-only переименование компании.

### `POST /api/auth/companies/switch`
- Roles: `ADMIN | EDITOR | VIEWER | FINANCE`
- Body: `{ companyId: string }`
- Назначение: переключить активную компанию пользователя.

### `PATCH /api/auth/projects/:projectId`
- Roles: `ADMIN | EDITOR | VIEWER | FINANCE`
- Body: `{ name: string }`
- Назначение: owner-only переименование project-space.

### `DELETE /api/auth/projects/:projectId`
- Roles: `ADMIN | EDITOR | VIEWER | FINANCE`
- Назначение: owner-only удаление project-space.
- Response: JWT payload (token + user) с новым активным project-context.

### `GET /api/auth/projects/:projectId/members`
- Roles: `ADMIN | EDITOR | VIEWER | FINANCE`
- Назначение: получить список участников project-space (доступно только участникам).

### `POST /api/auth/projects/:projectId/invite`
- Roles: `ADMIN | EDITOR | VIEWER | FINANCE`
- Body: `{ email: string, permission: 'viewer' | 'editor' }`
- Назначение: owner-only приглашение существующего пользователя в project-space.
- Ошибки:
  - `ERR_AUTH_PROJECT_ACCESS_DENIED` — проект недоступен или вызывающий не owner,
  - `ERR_AUTH_PROJECT_INVITE_USER_NOT_FOUND` — пользователь с таким email не найден.

### `PATCH /api/auth/projects/:projectId/members/:targetUserId`
- Roles: `ADMIN | EDITOR | VIEWER | FINANCE`
- Body: `{ permission: 'viewer' | 'editor' }`
- Назначение: owner-only смена роли участника.

### `DELETE /api/auth/projects/:projectId/members/:targetUserId`
- Roles: `ADMIN | EDITOR | VIEWER | FINANCE`
- Назначение: owner-only удаление участника из project-space.

## Roles

### `POST /api/roles`
- Roles: `ADMIN`
- Body: `CreateRoleDto`

### `POST /api/roles/defaults`
- Roles: `ADMIN`
- Назначение: создать дефолтный набор ролей для активной компании.

### `GET /api/roles`
- Roles: `ADMIN | EDITOR | VIEWER | FINANCE`

### `PATCH /api/roles/:id`
- Roles: `ADMIN`
- Body: `UpdateRoleDto`

### `DELETE /api/roles/:id`
- Roles: `ADMIN`

## Departments

### `POST /api/departments`
- Roles: `ADMIN`
- Body: `CreateDepartmentDto` (`name`, `description?`, `colorHex?`)

### `POST /api/departments/defaults`
- Roles: `ADMIN`
- Назначение: создать дефолтный набор департаментов для активной компании.

### `GET /api/departments`
- Roles: `ADMIN | EDITOR | VIEWER | FINANCE`

### `PATCH /api/departments/:id`
- Roles: `ADMIN`
- Body: `UpdateDepartmentDto` (`name?`, `description?`, `colorHex?`)

### `DELETE /api/departments/:id`
- Roles: `ADMIN`

## Grades

### `POST /api/grades`
- Roles: `ADMIN`
- Body: `CreateGradeDto`

### `POST /api/grades/defaults`
- Roles: `ADMIN`
- Назначение: создать дефолтный набор грейдов для активной компании.

### `GET /api/grades`
- Roles: `ADMIN | EDITOR | VIEWER | FINANCE`

### `PATCH /api/grades/:id`
- Roles: `ADMIN`
- Body: `UpdateGradeDto`

### `DELETE /api/grades/:id`
- Roles: `ADMIN`

## Employees

### `POST /api/employees`
- Roles: `ADMIN | EDITOR`
- Body: `CreateEmployeeDto` (`email` опциональный, может быть `null`)

### `POST /api/employees/import-csv`
- Roles: `ADMIN | EDITOR`
- Body: `{ csv: string }`

### `GET /api/employees`
- Roles: `ADMIN | EDITOR | VIEWER | FINANCE`

### `PATCH /api/employees/:id`
- Roles: `ADMIN | EDITOR`
- Body: `UpdateEmployeeDto`

### `DELETE /api/employees/:id`
- Roles: `ADMIN`

## Skills

### `POST /api/skills`
- Roles: `ADMIN`
- Body: `CreateSkillDto`

### `GET /api/skills`
- Roles: `ADMIN | EDITOR | VIEWER | FINANCE`

### `PATCH /api/skills/:id`
- Roles: `ADMIN`
- Body: `UpdateSkillDto`

### `DELETE /api/skills/:id`
- Roles: `ADMIN`

### `POST /api/skills/:id/employees/:employeeId`
- Roles: `ADMIN | EDITOR`
- Назначение: привязать навык сотруднику

### `DELETE /api/skills/:id/employees/:employeeId`
- Roles: `ADMIN | EDITOR`

## Demo

### `POST /api/demo/seed`
- Roles: `ADMIN | EDITOR`
- Назначение: создать/обновить демо-данные в активном workspace ("шаблонный проект").
- Если у демо-сотрудников нет активной персональной ставки, seed создаёт `CostRate` ("salary") на employee.
- Назначение: отвязать навык от сотрудника

## Vacations

- Все endpoints раздела работают в рамках активного `workspaceId` из JWT.

### `POST /api/vacations`
- Roles: `ADMIN | EDITOR`
- Body: `CreateVacationDto`

### `GET /api/vacations`
- Roles: `ADMIN | EDITOR | VIEWER | FINANCE`

### `GET /api/vacations/:id`
- Roles: `ADMIN | EDITOR | VIEWER | FINANCE`

### `PATCH /api/vacations/:id`
- Roles: `ADMIN | EDITOR`
- Body: `UpdateVacationDto`

### `DELETE /api/vacations/:id`
- Roles: `ADMIN`

## Cost Rates

- Все endpoints раздела работают в рамках активного `workspaceId` из JWT.

### `POST /api/cost-rates`
- Roles: `ADMIN | EDITOR | FINANCE`
- Body: `CreateCostRateDto`

### `GET /api/cost-rates`
- Roles: `ADMIN | EDITOR | VIEWER | FINANCE`

### `GET /api/cost-rates/:id`
- Roles: `ADMIN | EDITOR | VIEWER | FINANCE`

### `PATCH /api/cost-rates/:id`
- Roles: `ADMIN | EDITOR | FINANCE`
- Body: `UpdateCostRateDto`

### `DELETE /api/cost-rates/:id`
- Roles: `ADMIN | EDITOR | FINANCE`

## Projects

### `POST /api/projects`
- Roles: `ADMIN | EDITOR`
- Body: `CreateProjectDto`
  - `code: string`
  - `name: string`
  - `startDate: ISO string`
  - `endDate: ISO string`
  - `teamTemplateId?: string`

### `GET /api/projects`
- Roles: `ADMIN | EDITOR | VIEWER | FINANCE`

### `GET /api/projects/:id`
- Roles: `ADMIN | EDITOR | VIEWER | FINANCE`
- Возвращает `teamTemplate` (если привязан) с ролями шаблона.

### `PATCH /api/projects/:id`
- Roles: `ADMIN | EDITOR`
- Body: `UpdateProjectDto`
  - поддерживает `teamTemplateId?: string | null` (отвязка через `null`/пустое значение в payload клиента).

### `DELETE /api/projects/:id`
- Roles: `ADMIN`

### `GET /api/projects/:id/members`
- Roles: `ADMIN | EDITOR | VIEWER | FINANCE`

### `POST /api/projects/:id/members`
- Roles: `ADMIN | EDITOR`
- Body: `{ employeeId: string }`

### `DELETE /api/projects/:id/members/:employeeId`
- Roles: `ADMIN | EDITOR`

## Team Templates

### `POST /api/team-templates`
- Roles: `ADMIN`
- Body:
  - `name: string`
  - `roleIds: string[]` (минимум 1)

### `POST /api/team-templates/defaults`
- Roles: `ADMIN`
- Назначение: создать дефолтный набор шаблонов команды для активной компании.

### `GET /api/team-templates`
- Roles: `ADMIN | EDITOR | VIEWER | FINANCE`
- Response: список шаблонов с вложенными ролями (`roles[]`, `role.id/name/shortName`).

### `PATCH /api/team-templates/:id`
- Roles: `ADMIN`
- Body:
  - `name?: string`
  - `roleIds?: string[]`

### `DELETE /api/team-templates/:id`
- Roles: `ADMIN`

## Assignments

### `POST /api/assignments`
- Roles: `ADMIN | EDITOR`
- Body: `CreateAssignmentDto`

### `GET /api/assignments`
- Roles: `ADMIN | EDITOR | VIEWER | FINANCE`

### `GET /api/assignments/:id`
- Roles: `ADMIN | EDITOR | VIEWER | FINANCE`

### `PATCH /api/assignments/:id`
- Roles: `ADMIN | EDITOR`
- Body: `UpdateAssignmentDto`

### `DELETE /api/assignments/:id`
- Roles: `ADMIN`

## Project member vs assignment lifecycle
- `ProjectMember` и `ProjectAssignment` ведутся раздельно и имеют разные бизнес-цели.
- `POST /api/assignments` и `PATCH /api/assignments/:id` не создают membership автоматически для пары `projectId + employeeId`.
- Текущее ограничение модели: только один assignment на сотрудника в проекте (`projectId + employeeId` уникальны).
- `DELETE /api/assignments/:id` не удаляет membership автоматически.
- `DELETE /api/projects/:id/members/:employeeId` не удаляет assignment автоматически.
- Если assignment существует без membership, update/create assignment не восстанавливает membership автоматически.

### Ключевые error-коды модели
- `ERR_PROJECT_MEMBER_ALREADY_EXISTS` — повторное добавление member в проект.
- `ERR_PROJECT_MEMBER_NOT_FOUND` — попытка удалить несуществующий member.
- `ERR_ASSIGNMENT_EMPLOYEE_ALREADY_IN_PROJECT` — попытка создать второй assignment той же пары `project + employee`.
- `ERR_ASSIGNMENT_DATE_RANGE_INVALID` — конец assignment раньше начала.
- `ERR_PROJECT_DATE_RANGE_INVALID` — конец проекта раньше начала.

### Политика диапазона assignment
- Assignment допускается вне плановых дат проекта.
- Несоответствие факта/плана отражается в Timeline как диагностическая ошибка `fact-range`, но не блокирует CRUD assignment.

### Текущие ограничения (open gaps)
- Коды `ERR_ASSIGNMENT_OVERLAPS_VACATION`, `ERR_ASSIGNMENT_EMPLOYEE_OVERLOADED` зарезервированы в `error-codes`, но не задействованы как единое правило во всех assignment-flow.

## Timeline

### `GET /api/timeline/year?year=YYYY`
- Roles: `ADMIN | EDITOR | VIEWER | FINANCE`
- Query:
  - `year` (number, required)

## Calendar

### `GET /api/calendar/health/status`
- Roles: `ADMIN | EDITOR | VIEWER | FINANCE`

### `POST /api/calendar/sync`
- Roles: `ADMIN | EDITOR`
- Body: `{ years?: number[], force?: boolean, includeNextYear?: boolean }`

### `GET /api/calendar/:year?refresh=true|false`
- Roles: `ADMIN | EDITOR | VIEWER | FINANCE`
- Params:
  - `year` (number, required)
- Query:
  - `refresh` (boolean, optional)

## Notes
- DTO-поля и валидация определяются в `apps/api/src/**/dto/*`.
- Ошибки возвращаются в стандартизированном формате с кодами из `apps/api/src/common/error-codes.ts`.
- Для обновления этого документа после изменений API ориентируйтесь на контроллеры `apps/api/src/**/*.controller.ts`.