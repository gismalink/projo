# API Reference

Актуально для текущей реализации `apps/api`.

## Base URL
- Локально: `http://localhost:4000`
- Глобальный префикс API: `/api`
- Итоговый base: `http://localhost:4000/api`

## Auth model
- `POST /api/auth/login` — публичный endpoint (без JWT).
- Остальные endpoints (кроме `GET /api/health`) защищены `JwtAuthGuard` + `RolesGuard`.
- Роли доступа: `ADMIN`, `PM`, `VIEWER`, `FINANCE`.

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

### `POST /api/auth/register`
- Auth: public
- Body: `{ email: string, fullName: string, password: string }`
- Response: JWT payload (token + user)

### `GET /api/auth/me`
- Roles: `ADMIN | PM | VIEWER | FINANCE`
- Response: текущий пользователь + активный project-context (`workspaceId`, `workspaceRole`)

### `GET /api/auth/projects`
- Roles: `ADMIN | PM | VIEWER | FINANCE`
- Response: `{ activeProjectId, myProjects[], sharedProjects[] }`

### `POST /api/auth/projects`
- Roles: `ADMIN | PM | VIEWER | FINANCE`
- Body: `{ name: string }`
- Назначение: создать новый project-space и сделать его активным.

### `POST /api/auth/projects/switch`
- Roles: `ADMIN | PM | VIEWER | FINANCE`
- Body: `{ projectId: string }`
- Назначение: переключить активный project-space пользователя.

### `PATCH /api/auth/projects/:projectId`
- Roles: `ADMIN | PM | VIEWER | FINANCE`
- Body: `{ name: string }`
- Назначение: owner-only переименование project-space.

### `DELETE /api/auth/projects/:projectId`
- Roles: `ADMIN | PM | VIEWER | FINANCE`
- Назначение: owner-only удаление project-space.
- Response: JWT payload (token + user) с новым активным project-context.

### `GET /api/auth/projects/:projectId/members`
- Roles: `ADMIN | PM | VIEWER | FINANCE`
- Назначение: получить список участников project-space (доступно только участникам).

### `POST /api/auth/projects/:projectId/invite`
- Roles: `ADMIN | PM | VIEWER | FINANCE`
- Body: `{ email: string, permission: 'viewer' | 'editor' }`
- Назначение: owner-only приглашение существующего пользователя в project-space.
- Ошибки:
  - `ERR_AUTH_PROJECT_ACCESS_DENIED` — проект недоступен или вызывающий не owner,
  - `ERR_AUTH_PROJECT_INVITE_USER_NOT_FOUND` — пользователь с таким email не найден.

### `PATCH /api/auth/projects/:projectId/members/:targetUserId`
- Roles: `ADMIN | PM | VIEWER | FINANCE`
- Body: `{ permission: 'viewer' | 'editor' }`
- Назначение: owner-only смена роли участника.

### `DELETE /api/auth/projects/:projectId/members/:targetUserId`
- Roles: `ADMIN | PM | VIEWER | FINANCE`
- Назначение: owner-only удаление участника из project-space.

## Roles

### `POST /api/roles`
- Roles: `ADMIN`
- Body: `CreateRoleDto`

### `GET /api/roles`
- Roles: `ADMIN | PM | VIEWER | FINANCE`

### `PATCH /api/roles/:id`
- Roles: `ADMIN`
- Body: `UpdateRoleDto`

### `DELETE /api/roles/:id`
- Roles: `ADMIN`

## Departments

### `POST /api/departments`
- Roles: `ADMIN`
- Body: `CreateDepartmentDto` (`name`, `description?`, `colorHex?`)

### `GET /api/departments`
- Roles: `ADMIN | PM | VIEWER | FINANCE`

### `PATCH /api/departments/:id`
- Roles: `ADMIN`
- Body: `UpdateDepartmentDto` (`name?`, `description?`, `colorHex?`)

### `DELETE /api/departments/:id`
- Roles: `ADMIN`

## Employees

### `POST /api/employees`
- Roles: `ADMIN | PM`
- Body: `CreateEmployeeDto`

### `POST /api/employees/import-csv`
- Roles: `ADMIN | PM`
- Body: `{ csv: string }`

### `GET /api/employees`
- Roles: `ADMIN | PM | VIEWER | FINANCE`

### `PATCH /api/employees/:id`
- Roles: `ADMIN | PM`
- Body: `UpdateEmployeeDto`

### `DELETE /api/employees/:id`
- Roles: `ADMIN`

## Skills

### `POST /api/skills`
- Roles: `ADMIN`
- Body: `CreateSkillDto`

### `GET /api/skills`
- Roles: `ADMIN | PM | VIEWER | FINANCE`

### `PATCH /api/skills/:id`
- Roles: `ADMIN`
- Body: `UpdateSkillDto`

### `DELETE /api/skills/:id`
- Roles: `ADMIN`

### `POST /api/skills/:id/employees/:employeeId`
- Roles: `ADMIN | PM`
- Назначение: привязать навык сотруднику

### `DELETE /api/skills/:id/employees/:employeeId`
- Roles: `ADMIN | PM`
- Назначение: отвязать навык от сотрудника

## Vacations

- Все endpoints раздела работают в рамках активного `workspaceId` из JWT.

### `POST /api/vacations`
- Roles: `ADMIN | PM`
- Body: `CreateVacationDto`

### `GET /api/vacations`
- Roles: `ADMIN | PM | VIEWER | FINANCE`

### `GET /api/vacations/:id`
- Roles: `ADMIN | PM | VIEWER | FINANCE`

### `PATCH /api/vacations/:id`
- Roles: `ADMIN | PM`
- Body: `UpdateVacationDto`

### `DELETE /api/vacations/:id`
- Roles: `ADMIN`

## Cost Rates

- Все endpoints раздела работают в рамках активного `workspaceId` из JWT.

### `POST /api/cost-rates`
- Roles: `ADMIN | FINANCE`
- Body: `CreateCostRateDto`

### `GET /api/cost-rates`
- Roles: `ADMIN | PM | VIEWER | FINANCE`

### `GET /api/cost-rates/:id`
- Roles: `ADMIN | PM | VIEWER | FINANCE`

### `PATCH /api/cost-rates/:id`
- Roles: `ADMIN | FINANCE`
- Body: `UpdateCostRateDto`

### `DELETE /api/cost-rates/:id`
- Roles: `ADMIN | FINANCE`

## Projects

### `POST /api/projects`
- Roles: `ADMIN | PM`
- Body: `CreateProjectDto`
  - `code: string`
  - `name: string`
  - `startDate: ISO string`
  - `endDate: ISO string`
  - `teamTemplateId?: string`

### `GET /api/projects`
- Roles: `ADMIN | PM | VIEWER | FINANCE`

### `GET /api/projects/:id`
- Roles: `ADMIN | PM | VIEWER | FINANCE`
- Возвращает `teamTemplate` (если привязан) с ролями шаблона.

### `PATCH /api/projects/:id`
- Roles: `ADMIN | PM`
- Body: `UpdateProjectDto`
  - поддерживает `teamTemplateId?: string | null` (отвязка через `null`/пустое значение в payload клиента).

### `DELETE /api/projects/:id`
- Roles: `ADMIN`

### `GET /api/projects/:id/members`
- Roles: `ADMIN | PM | VIEWER | FINANCE`

### `POST /api/projects/:id/members`
- Roles: `ADMIN | PM`
- Body: `{ employeeId: string }`

### `DELETE /api/projects/:id/members/:employeeId`
- Roles: `ADMIN | PM`

## Team Templates

### `POST /api/team-templates`
- Roles: `ADMIN`
- Body:
  - `name: string`
  - `roleIds: string[]` (минимум 1)

### `GET /api/team-templates`
- Roles: `ADMIN | PM | VIEWER | FINANCE`
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
- Roles: `ADMIN | PM`
- Body: `CreateAssignmentDto`

### `GET /api/assignments`
- Roles: `ADMIN | PM | VIEWER | FINANCE`

### `GET /api/assignments/:id`
- Roles: `ADMIN | PM | VIEWER | FINANCE`

### `PATCH /api/assignments/:id`
- Roles: `ADMIN | PM`
- Body: `UpdateAssignmentDto`

### `DELETE /api/assignments/:id`
- Roles: `ADMIN`

## Project member vs assignment lifecycle
- `ProjectMember` и `ProjectAssignment` ведутся раздельно и имеют разные бизнес-цели.
- При `POST /api/assignments` и `PATCH /api/assignments/:id` backend автоматически обеспечивает существование membership для пары `projectId + employeeId`.
- Текущее ограничение модели: только один assignment на сотрудника в проекте (`projectId + employeeId` уникальны).
- `DELETE /api/assignments/:id` не удаляет membership автоматически.
- `DELETE /api/projects/:id/members/:employeeId` не удаляет assignment автоматически.
- Если assignment существует без membership и выполняется update/create assignment — membership будет восстановлен автоматически.

### Ключевые error-коды модели
- `ERR_PROJECT_MEMBER_ALREADY_EXISTS` — повторное добавление member в проект.
- `ERR_PROJECT_MEMBER_NOT_FOUND` — попытка удалить несуществующий member.
- `ERR_ASSIGNMENT_EMPLOYEE_ALREADY_IN_PROJECT` — попытка создать второй assignment той же пары `project + employee`.
- `ERR_ASSIGNMENT_DATE_RANGE_INVALID` — конец assignment раньше начала.
- `ERR_PROJECT_DATE_RANGE_INVALID` — конец проекта раньше начала.

## Timeline

### `GET /api/timeline/year?year=YYYY`
- Roles: `ADMIN | PM | VIEWER | FINANCE`
- Query:
  - `year` (number, required)

## Calendar

### `GET /api/calendar/health/status`
- Roles: `ADMIN | PM | VIEWER | FINANCE`

### `POST /api/calendar/sync`
- Roles: `ADMIN | PM`
- Body: `{ years?: number[], force?: boolean, includeNextYear?: boolean }`

### `GET /api/calendar/:year?refresh=true|false`
- Roles: `ADMIN | PM | VIEWER | FINANCE`
- Params:
  - `year` (number, required)
- Query:
  - `refresh` (boolean, optional)

## Notes
- DTO-поля и валидация определяются в `apps/api/src/**/dto/*`.
- Ошибки возвращаются в стандартизированном формате с кодами из `apps/api/src/common/error-codes.ts`.
- Для обновления этого документа после изменений API ориентируйтесь на контроллеры `apps/api/src/**/*.controller.ts`.