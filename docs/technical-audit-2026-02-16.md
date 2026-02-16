# Technical Audit — 2026-02-16

## Scope
- Обновление документации под текущее состояние проекта.
- Быстрый аудит кода на срочный рефакторинг и hardcode.

## Summary
- Платформа функционально расширена (team templates + project binding), но в коде накопились точки техдолга.
- Главные риски: security/dev-hardcode, ослабленная типизация (`as any`), магические числа, часть логики локали завязана на текстовые значения.

## Срочный рефакторинг (P1)

### 1) Hardcoded bootstrap credentials и demo defaults
- `apps/api/src/users/users.service.ts`
  - `BOOTSTRAP_PASSWORD = 'ProjoAdmin!2026'`
  - email `'admin@projo.local'`
- `apps/web/src/hooks/useAppState.ts`
  - дефолтные login credentials в state.
- Риск:
  - утечка секретов в исходниках,
  - неверный operational pattern для staging/prod.
- Рекомендация:
  - вынести в env (`BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`, `WEB_DEFAULT_LOGIN_EMAIL`, `WEB_DEFAULT_LOGIN_PASSWORD`),
  - в прод режиме не использовать дефолтный пароль без явной инициализации.

### 2) Ослабленная типизация через `as any`
- `apps/api/src/team-templates/team-templates.service.ts`
- Текущее состояние: обход типизации Prisma delegate через `as any`.
- Риск:
  - теряются compile-time гарантии,
  - повышается вероятность runtime-ошибок при эволюции schema.
- Рекомендация:
  - убрать `as any`,
  - закрепить типобезопасный доступ к Prisma delegates,
  - добавить проверку на CI: запрет новых `as any` в `apps/api/src`.

### 3) Локализация через текстовые признаки
- `apps/web/src/components/personnel/PersonnelTab.tsx`
  - locale определяется через `t.prev === 'Назад'`.
- Риск:
  - хрупкость при изменении переводов,
  - неочевидная зависимость между UI-текстом и бизнес-логикой.
- Рекомендация:
  - передавать `lang`/`locale` явно в компоненты,
  - не вычислять режимы по translated string values.

## High-priority hardcode cleanup (P2)

### 4) Магические числа и технические тайминги
- `apps/web/src/hooks/useAppHandlers.ts`
  - `MONTHLY_HOURS = 168`
  - таймауты `420ms`, `4500ms`.
- `apps/web/src/hooks/useAppState.ts`
  - дефолтные значения формы/проекта/дат.
- Рекомендация:
  - выделить `apps/web/src/constants/*`:
    - `business.constants.ts`
    - `ui.constants.ts`
    - `seed-defaults.constants.ts`
  - использовать именованные константы вместо inline literals.

### 5) Цветовые fallback literals в компонентах
- Примеры:
  - `apps/web/src/components/timeline/TimelineTab.tsx` (`#6E7B8A` fallback)
  - `apps/web/src/components/personnel/PersonnelTab.tsx` (`#B6BDC6`, `#fff`, `#6E7B8A`)
  - `apps/web/src/components/timeline/BenchColumn.tsx` (`#6E7B8A`)
- Риск:
  - рассинхронизация визуальных токенов,
  - дублирование theme decisions.
- Рекомендация:
  - переиспользовать theme-токены из CSS variables,
  - минимизировать inline hex в TSX.

## Medium-priority refactor (P3)

### 6) Укрупнение `useAppHandlers`
- `apps/web/src/hooks/useAppHandlers.ts` содержит слишком много ответственности:
  - auth,
  - справочники,
  - employees,
  - vacations,
  - projects,
  - assignments,
  - timeline/calendar orchestration.
- Риск:
  - низкая читаемость,
  - сложная поддержка/тестирование,
  - повышенный риск регрессий.
- Рекомендация:
  - разбить на domain hooks:
    - `useAuthHandlers`,
    - `usePersonnelHandlers`,
    - `useProjectHandlers`,
    - `useTimelineHandlers`.

### 7) Дубли в документации
- `docs/implementation-roadmap.md` содержит пересекающиеся блоки задач разных волн.
- Рекомендация:
  - выделить секции `Done / In Progress / Next` с датами,
  - архивировать завершенные waves в отдельный changelog/архив.

## Быстрый план работ
1. Security/Config pass (credentials + env) — 1 инкремент.
2. Type safety pass (удаление `as any` + CI guard) — 1 инкремент.
3. Constants/theme pass (магические числа + color fallback) — 1-2 инкремента.
4. Handlers decomposition pass — 2+ инкремента.

## Exit criteria для следующего техдолг-спринта
- Нет hardcoded credentials в `apps/api/src` и `apps/web/src`.
- Нет `as any` в `apps/api/src`.
- Основные UI/business literals вынесены в именованные constants.
- Локаль определяется явно, без string-comparison переводов.
