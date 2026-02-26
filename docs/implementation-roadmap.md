# План реализации (актуализация: 2026-02-26)

## 1) Назначение документа
- Этот файл хранит только **актуальный план предстоящих работ** и приоритеты текущего блока.
- Закрытые задачи и реализованное поведение сюда не дублируются: после закрытия блока они переносятся в профильные документы.
- Исторический прогресс и факт поставки фиксируются в Git history и релизных документах.

## 2) Где фиксируется закрытое
- Технические результаты, риски и срезы качества: `docs/audits/*`.
- Архитектурные изменения и инварианты: `docs/architecture-overview.md`.
- Актуальное продуктовое поведение и правила: `docs/product-spec.md`.
- Производительность и нагрузочные измерения: `docs/performance/*`.
- Процедуры поставки и релизный контур: `docs/release-runbook.md`, `docs/releases/*`.
- История изменений по коммитам/PR: git history.

## 3) Активные приоритеты

### Временный статус блока (до закрытия)

Правило ведения:
- В roadmap держим только **временные пункты по текущему блоку**, пока он не закрыт.
- После закрытия блока результат переносится в:
   - продуктовое поведение: `docs/product-spec.md`,
   - архитектурные изменения и инварианты: `docs/architecture-overview.md`,
   - аудит/качество (при необходимости): `docs/audits/*`.
- Из roadmap закрытый блок удаляется, чтобы не дублировать «источник правды».

Временный прогресс текущего блока:
- [x] P1 done: унификация формулы KPI «Мои планы» под годовую утилизацию и устранение аномалий `>1000%`.
- [~] P2 in progress: в селекторе компаний добавлены счетчики планов `Название (N)` + реактивное обновление после операций с планами (test).
- [~] P4.2 in progress: доведение стабильного non-skip покрытия критических API smoke-сценариев.
- [~] P4.10 started: фронтовый performance/responsiveness baseline и release-gate.

#### Next (ближайший фокус)

##### P1 — Критичный баг расчета нагрузки
1. [x] Исправить расхождение процентов в «Мои планы» vs «Годовая нагрузка».
   - [x] Убрано расхождение формулы в карточках «Мои планы»: `avg/max` берутся из каноничных `totalAllocationPercent/peakAllocationPercent` API.
   - [x] Убраны аномалии вида `>1000%` при реальном значении около `94%`.
   - [x] Прогон `SMOKE_API=1 npm run check` выполнен успешно (без fail; текущий skip в employee-сценариях зависит от scope/roles workspace).
    - **DoD:**
       - [x] На тестовых данных значения в обоих блоках совпадают (допуск: не более 0.1 п.п.).
       - [x] Невозможно получить аномальный процент при валидных входных данных.
       - [x] `npm run check` и `SMOKE_API=1 npm run check` проходят.

##### P2 — Прозрачность списка компаний
1. [x] В селекторе компаний показывать количество планов в формате `Название компании (N)`.
   - [x] Добавлен API smoke-сценарий проверки счетчиков компаний для owner/non-owner (`company counters are correct for owner and non-owner`).
   - [x] Добавлено удаление компании (owner-only): backend endpoint `DELETE /auth/companies/:companyId`, ротация токена и UI-кнопка удаления в header с подтверждением.
   - [x] Ручной smoke переключения/удаления компаний зафиксирован: `docs/audits/company-switch-delete-smoke-2026-02-27.md`.
    - **DoD:**
      - [x] Счетчик корректен для owner и non-owner сценариев.
      - [x] Ручной smoke сценария переключения компаний пройден.

#### Later (после стабилизации P1/P2)
- [ ] Импорт XLSX новой компании (`docs/imports/xlsx-company-import-plan.md`).
- [ ] Анимации сворачивания/разворачивания ключевых UI-блоков.
- [ ] AI-помощник для интеллектуальной правки планов (discovery -> MVP).
- [ ] Монетизация и killer-features (discovery).

### P4.5 — Импорт XLSX (новая компания)
План: `docs/imports/xlsx-company-import-plan.md`.

### P4 — Функциональные улучшения после стабилизации
1. [ ] Довести стабильность UX/метрик timeline на краевых сценариях.
   - [x] Во время драга со скамейки сворачивать проекты, чтобы не тащить карточку через весь экран и не скроллить вручную.
2. [~] Усилить тестовое покрытие критических сценариев (assignment/member, shift/resize, auth-flow).
   - [x] Добавлен формальный smoke-gate: `npm run test:e2e:api:gate` (пороги `E2E_MIN_TESTS` / `E2E_MAX_SKIPPED`) для фиксации pass-rate/skip-rate token-run.
   - [x] Smoke-набор разделен на `core (7)` и `extended (6)` сценарии (`npm run test:e2e:api:core|extended` + `...:gate:core|extended`) для быстрого обязательного gate и полного расширенного прогона.
   - [x] `verify-all` переключен на core-gate по умолчанию при `SMOKE_API=1`; extended-gate включается отдельно (`SMOKE_API_EXTENDED=1`).
   - [x] В smoke добавлен авто-bootstrap `POST /roles/defaults`, что снимает skip employee-сценариев при пустом каталоге ролей.
   - [x] В локальном/dev контуре достигнут стабильный non-skip прогон: `13/13 pass`, `0 skip`, `0 fail` (включая `E2E_MAX_SKIPPED=0`).
   - [x] Подтвержден non-skip baseline в test token-run контуре (`E2E_AUTH_MODE=sso` + `E2E_ACCESS_TOKEN`): `core gate = 7/7 pass, 0 skip, 0 fail`.
3. [x] Добавить страницу статистики для владельца/админа:
   - [x] Добавлен endpoint `GET /auth/companies/overview` (доступ owner/admin активной компании) с агрегатами пользователей и проектов.
   - [x] В `admin` табе для owner/admin добавлен отдельный company overview (общие users/projects + таблица `user/role/projects/plans`).
   - [x] Общее количество пользователей,
   - [x] Общее количество проектов,
   - [x] Количество проектов по каждому пользователю.
   - [x] Таблица пользователей с колонками: user, role, projects count, plans count.
4. [ ] Исследовать и реализовать мультикурсор в рамках проекта (desktop-only):
   - [ ] пользователи в одном проекте видят курсоры друг друга в реальном времени,
   - [ ] поддержать роли viewer/editor/owner,
   - [ ] не включать функциональность на мобильных устройствах.
5. [ ] Проверить адаптивность ключевых экранов и исправить стили для мобильных устройств.
6. [ ] Добавить предварительную валидацию полей на фронте (до отправки формы на API).
7. [ ] Подготовить следующий пакет продуктовых улучшений (отчеты, фильтры, интеграционные API-контракты).
8. [ ] Добавить анимации сворачивания/разворачивания ключевых UI-блоков:
   - [ ] фильтры,
   - [ ] секции списков,
   - [ ] панели с деталями/контекстом.
   - [ ] единый motion-pattern и тайминги, без перегруза интерфейса.
9. [ ] Проработать AI-помощник для интеллектуальной правки планов (discovery -> MVP):
   - [ ] определить use-cases (поиск конфликтов, балансировка загрузки, рекомендации),
   - [ ] спроектировать безопасный API-контур (read/write scope, audit trail),
   - [ ] сделать MVP (чат + ограниченный набор команд изменения плана),
   - [ ] ввести режим «предложение -> подтверждение пользователем».
10. [ ] Frontend performance & responsiveness plan (аудит -> стабилизация):
   - План: `docs/performance/frontend-performance-plan.md`
   - [ ] Зафиксировать baseline web bundle и сборки (`npm run build -w @projo/web`): размер `dist/assets/*.js`, gzip, время build.
   - [ ] Снять runtime-профиль Timeline в Chrome DevTools Performance (open timeline, scroll, drag assignment/project, bench filter): long tasks, FPS, scripting/layout/paint.
   - [ ] Снять React Profiler для `TimelineTab`/`ProjectAssignmentsCard`: commit duration, частота re-render, горячие ветки.
   - [ ] Прогнать UX-профиль в throttling-режимах (CPU x4 + Fast 3G/Slow 4G): TTI, latency до визуального отклика на drag/drop.
   - [ ] Ввести performance budgets и release-gate для фронта:
      - [ ] JS bundle gzip budget,
      - [ ] max long task budget,
      - [ ] p95 отклика drag/drop budget.
   - [ ] Добавить регулярный отчёт (1 markdown snapshot на итерацию: дата, SHA, метрики, выводы, action items).
   - **DoD:**
      - [ ] Есть актуальный baseline-док и повторяемый чеклист прогонов (local + test + throttling).
      - [ ] Для Timeline подтверждено отсутствие критических UI-freeze (нет long task > 100ms в целевых сценариях).
      - [ ] Для каждого релиз-кандидата есть измерение bundle/runtime и решение «go/no-go» по budget.

### P5 — Продукт и монетизация (discovery)
1. [ ] Сформировать гипотезы монетизации:
   - [ ] free/team/pro тарифы,
   - [ ] лимиты по пользователям/проектам,
   - [ ] paid add-ons (расширенная аналитика, AI-помощник, интеграции).
2. [ ] Выделить killer-features продукта:
   - [ ] 3–5 дифференциаторов по сравнению с альтернативами,
   - [ ] оценка ценности для owner/manager/employee,
   - [ ] привязка к roadmap и влиянию на конверсию/удержание.

## 5) Связанные документы
- `docs/audits/security-audit-2026-02-18.md`
- `docs/architecture-overview.md`
- `docs/product-spec.md`
- `docs/workflow-checklist.md`
- `docs/release-runbook.md`
- `docs/server-deploy-mac.md`
- `docs/performance-baseline-2026-02-15.md`
- `docs/performance/load-testing-plan.md`
- `docs/performance/frontend-performance-plan.md`
