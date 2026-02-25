# Нагрузочное тестирование Projo (одновременное редактирование планов)

Дата: 2026-02-24

## 1) Цель
Ответить на вопрос: **сколько одновременных пользователей** сервер выдержит при сценарии «пользователи открывают Timeline и редактируют свои планы», при размере компаний ~30–100 сотрудников.

Важно:
- По умолчанию тестируем **только `test`**.
- `prod` — только после успешного smoke в `test` и отдельного подтверждения.

## 2) Что считаем “редактированием плана” в API
Критические операции (как в текущей архитектуре):
- Чтение Timeline: `GET /api/timeline/year?year=YYYY`
- Редактирование assignment: `PATCH /api/assignments/:id` (например, изменение `allocationPercent` или `loadProfile`).

## 3) Набор данных (data shape)
Чтобы результат был близок к реальности, нужен workspace со следующими параметрами:
- Employees: 30 / 60 / 100
- Projects: (рекомендация) 10–40
- Assignments: чтобы у большинства проектов было 10–30 назначений

Замечание: на уровне БД действует ограничение `@@unique([projectId, employeeId])`, поэтому у одного сотрудника в одном проекте — ровно 1 assignment.

## 4) Аутентификация для нагрузочного теста
В `test/prod` локальный логин может быть отключен, поэтому самый простой вариант для нагрузки:
- получить JWT вручную (через браузер DevTools → Network → `GET /api/sso/get-token` → взять `token` из JSON),
- использовать этот JWT как `Authorization: Bearer <token>` в нагрузочном тесте.

Это не требует OAuth-автоматизации и подходит для «емкостного» теста API/DB.

## 5) Метрики успеха
Минимальный набор:
- Error rate: < 1% (исключая ожидаемые 4xx при конкуренции)
- Latency (p95):
  - Timeline `GET /timeline/year`: целевой p95 ≤ 1–2s (настраивается)
  - Assignment `PATCH /assignments/:id`: целевой p95 ≤ 1s
- Стабильность:
  - нет роста 5xx при удержании нагрузки
  - нет экспоненциального роста времени ответа

Инфраструктурные сигналы (на сервере):
- CPU/mem контейнера `projo-api-*`
- количество подключений к Postgres
- наличие ошибок в логах API

## 6) Сценарии (workloads)
### S1 — Read-heavy (просмотр)
- 90%: `GET /api/timeline/year`
- 10%: `GET /api/assignments`

### S2 — Edit-heavy (редактирование)
- 60%: `GET /api/timeline/year`
- 40%: `PATCH /api/assignments/:id` (малое изменение `allocationPercent`)

Примечание: если правим один и тот же assignment параллельно, возможны конфликты на уровне пользовательских ожиданий, но API должен оставаться стабильным (200/409 в зависимости от логики).

## 7) План прогона (test matrix)
Для каждого размера компании (30/60/100):
1) прогон S1 с ramp 1 → 25 → 50 → 100 VUs
2) прогон S2 с ramp 1 → 10 → 25 → 50 VUs

Останавливаем ramp, если:
- 5xx растут стабильно,
- p95 выходит за разумный предел,
- Postgres упирается в connections/CPU.

## 8) Инструмент
Рекомендуется k6 (CLI), т.к. просто запускать и удобно читать p95/ошибки.

Скрипты лежат в:
- `scripts/loadtest/k6-timeline-edit.js` — API-only (timeline + edit).
- `scripts/loadtest/k6-user-journey.js` — более «похоже на пользователя» (SPA `GET /` + assets + API bootstrap + timeline + edit).
- `scripts/loadtest/k6-timeline-edit-multitoken.js` — API-only, но с пулом токенов (важно для честной проверки capacity без искажения одним throttling bucket на токен).

Метрики по трафику:
- k6 в итоговой сводке показывает `data_received` / `data_sent` — это и есть общий объем трафика при прогоне.
- Для оценки пропускной способности запускайте тест **не на сервере**, а с отдельной машины/канала (иначе сеть будет слишком идеальной).

## 9) Результат
Фиксируем:
- максимальный устойчивый уровень VUs для каждого профиля нагрузки
- p50/p95, error rate
- `data_received` / `data_sent` (трафик) на этом плато
- серверные метрики на этом плато (docker stats / postgres connections / логи)
- рекомендации по оптимизациям (если нужно)

### 9.1 Фактические прогоны (test, 2026-02-24)
- Single-token (один и тот же Bearer для всех VU): уже на 80–100 VU наблюдался высокий fail-rate, что в основном отражает лимит одного throttling bucket, а не реальную емкость API/DB.
- Multi-token (пул уникальных Bearer в одном user/workspace context):
  - 100 VU: `http_req_failed = 0%`
  - 200 VU: `http_req_failed = 0%`
  - 300 VU: `http_req_failed ≈ 0.07%` (в основном transport/EOF)
  - 350 VU: `http_req_failed = 0%`, p95 около `1.24s`
  - 400 VU: `http_req_failed = 0.12%`, p95 около `1.93s`, `~299 req/s`, основная деградация в виде timeout/EOF при пике
  - 450 VU: `http_req_failed = 0.11%`, p95 около `2.49s`, `~312 req/s`, ошибки также преимущественно transport (`timeout`/`unexpected EOF`)
- Серверные метрики на 350–400 VU: `projo-api-test` держится в высоком CPU-профиле, `projo-db-test` нагружен умеренно, количество postgres connections стабильно около `15–16`, без признаков runaway по активным запросам.

Дополнение по 450 VU:
- По tails `samples.log`/`api-errors.log` паттерн сохраняется: API становится primary bottleneck, при этом БД остается стабильной по числу соединений; критического роста 5xx не зафиксировано.

Практический вывод для текущих лимитов сервера (без тюнинга):
- Рабочее «комфортное» плато: до ~350 VU для данного сценария.
- 400–450 VU — рабочая stress-зона (error rate низкий, но p95 заметно хуже); использовать как верхний предел baseline перед тюнингом, а не как steady-state цель.

## 10) Снятие метрик на сервере (во время прогона k6)
Запускать параллельно на сервере (лучше в `screen`/двух терминалах).

Если удобнее одной командой — используйте helper-скрипт:
`scripts/loadtest/server-metrics-test.sh test 1 300`

SSH-вариант (запуск с локальной машины):
```bash
ssh mac-mini 'cd ~/srv/projo && bash ./scripts/loadtest/server-metrics-test.sh test 1 300'
```

### 10.1 Контейнеры (CPU/RAM/NET/IO)
```bash
docker stats --no-stream

# live (остановить Ctrl+C)
docker stats projo-api-test projo-web-test projo-db-test
```

Для сохранения в лог (по 1 снимку в секунду):
```bash
while true; do date -u +%FT%TZ; docker stats --no-stream projo-api-test projo-db-test; echo; sleep 1; done | tee /tmp/projo-loadtest-docker-stats-test.log
```

### 10.2 Postgres connections + активные запросы
```bash
docker exec projo-db-test psql -U projo_test -d projo_test -c "select count(*) as connections from pg_stat_activity;"

docker exec projo-db-test psql -U projo_test -d projo_test -c "select state, count(*) from pg_stat_activity group by 1 order by 2 desc;"
```

Если нужно увидеть «тяжелые» запросы прямо во время прогона:
```bash
docker exec projo-db-test psql -U projo_test -d projo_test -c "select pid, now()-query_start as dur, left(query,200) as q from pg_stat_activity where state<>'idle' order by dur desc limit 10;"
```

### 10.3 Логи API (ошибки)
```bash
docker logs --tail=200 -f projo-api-test | egrep -i 'error|exception|fatal|unhandled|ECONN|ENOTFOUND|timeout|too many|429|502|503' || true
```

### 10.4 Ingress/edge (если подозрение на 5xx/502)
```bash
cd ~/srv/edge/ingress && docker compose logs --tail=200 -f
```

Примечания:
- Имена контейнеров для `prod`: `projo-api-prod`, `projo-web-prod`, `projo-db-prod`.
- Параметры пользователя/БД внутри контейнера Postgres зависят от env; если команда `psql` не проходит — смотрим `docker exec projo-db-test env | grep POSTGRES_` и подставляем правильные значения.
