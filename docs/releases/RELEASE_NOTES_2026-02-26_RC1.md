# Релиз-ноты — RC1 (2026-02-26)

## Область релиза
- Репозиторий: `projo`
- Ветка: `feature/gitops-test-branch-policy`
- Кандидат SHA: `23ed340`
- Диапазон коммитов: `2e53bf7..23ed340`

## Что вошло

### Продукт / UX
- Timeline: недельные бары выровнены по реальным границам недель и ограничены диапазоном понедельник–пятница (`c13f978`, `2dc840f`).
- Timeline: оверлеи праздников/выходных переведены в непрозрачные пастельные цвета для лучшей читаемости (`900fec5`).
- Timeline: добавлены действия дублирования/удаления проектов в UI (`6c3cede`).
- Селектор компаний: показывается количество планов в формате `Company (N)` с реактивным обновлением (`19c55f6`).
- Модалка аккаунта в SSO-режиме скрывает локальное управление credential-полями (`817e59a`).

### API / доменная логика
- Исправлена нормализация KPI для годовой утилизации и защищены месячные усреднения от аномалий (`3f4af5a`, `f06e64e`, `cfbb908`).
- Удаление сотрудников отвязано от legacy-связки с project-member; добавлена зачистка legacy-ссылок (`374c3f6`).
- Усилен SSO proxy: timeout на upstream и контролируемая ошибка `503 ERR_SSO_UPSTREAM_UNAVAILABLE` (`7fcf8e8`).
- Усилен CORS: deny-path переведён на `callback(null, false)` с безопасным логированием origin (`e6dd467`).

### Платформа / релиз-инжиниринг
- API smoke-тесты сделаны устойчивыми к окружению: preflight доступности + skip-safe поведение (`c6e5a50`).
- В `host compose` `VITE_*` build args переведены на env-substitution из единого источника (`bb495b8`).
- Deploy-скрипты теперь пишут маркеры задеплоенного SHA и предупреждают о `detached HEAD` (`692ed27`).
- Runbook релиза дополнен явным pre-prod checklist (`23ed340`).

## Подтверждения проверок
- `npm run check` — зелёный.
- `SMOKE_API=1 npm run check` — зелёный/skip-safe в окружениях без local auth.
- `E2E_API_URL=https://test.projo.gismalink.art/api SMOKE_API=1 npm run check` — зелёный с ожидаемыми skip по disabled local auth.
- Test deploy: `deploy-test-from-ref.sh` выполнен успешно.
- Платформенный smoke: `ssh mac-mini 'cd ~/srv/edge && ./scripts/test-smoke.sh --local test'` -> `== smoke: OK ==`.
- Критический ручной SSO flow: login/logout подтверждён оператором.

## Риски
- Основной остаточный риск — операционный checklist для `prod`: backup БД + окно пост-релизного мониторинга.
- В сборке остаётся неблокирующее предупреждение Vite по размеру чанков (>500 kB).

## Rollback
1. Определить предыдущий стабильный SHA в `origin/main`.
2. Запустить prod deploy-скрипт на этот SHA:
   - `ssh mac-mini 'cd ~/srv/projo && ./scripts/examples/deploy-prod-from-ref.sh origin/main ~/srv/projo'`
   - либо использовать явный стабильный ref/tag.
3. Проверить health:
   - `curl -fsS https://projo.gismalink.art/api/health`
   - `curl -I https://projo.gismalink.art`
4. Проверить маркер и историю деплоя:
   - `~/srv/projo/.deploy/last-deploy-prod.env`
   - `~/srv/projo/.deploy/deploy-history.log`
