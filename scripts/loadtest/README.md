# Projo load test (k6)

## What it does
Two scenarios:

1) `k6-timeline-edit.js` (API-only)
- load Timeline year view (`GET /api/timeline/year?year=...`)
- sometimes edit an assignment (`PATCH /api/assignments/:id`)

2) `k6-user-journey.js` (more browser-like)
- load SPA (`GET /`) and its `/assets/*`
- call bootstrap API endpoints (`/api/auth/*`, `/api/assignments`, `/api/timeline/year`)
- sometimes edit an assignment

This is designed for **test** environment first.

## Prereqs
- Install k6 (macOS): `brew install k6`
- You need a JWT for Projo API.

## Get JWT (SSO mode)
1) Open `https://test.projo.gismalink.art` in the browser and log in.
2) Open DevTools → Network.
3) Find request `GET /api/sso/get-token`.
4) In its JSON response, copy `token`.

## Run
```bash
export PROJO_BASE_URL='https://test.projo.gismalink.art'
export PROJO_JWT='<paste token>'
export PROJO_YEAR='2026'
export PROJO_EDIT_RATIO='0.4'

k6 run scripts/loadtest/k6-timeline-edit.js

# more browser-like
k6 run scripts/loadtest/k6-user-journey.js

# on the server (in parallel) capture metrics for 5 minutes
./scripts/loadtest/server-metrics-test.sh test 1 300

# same via ssh from local machine
ssh mac-mini 'cd ~/srv/projo && bash ./scripts/loadtest/server-metrics-test.sh test 1 300'

# via local SSH wrapper
bash ./scripts/loadtest/ssh-server-metrics.sh test 1 300
```

## SSH-first workflow (recommended for your setup)
1) Start metrics capture on server:
```bash
ssh mac-mini 'cd ~/srv/projo && bash ./scripts/loadtest/server-metrics-test.sh test 1 300'
```
2) Run k6 from your local machine/network:
```bash
k6 run scripts/loadtest/k6-user-journey.js
```
3) Read collected logs on server:
```bash
ssh mac-mini 'ls -1dt /tmp/projo-loadtest-test-* | head -n 1'
ssh mac-mini 'latest=$(ls -1dt /tmp/projo-loadtest-test-* | head -n 1); echo "$latest"; tail -n 80 "$latest/samples.log"; tail -n 80 "$latest/api-errors.log"'
```

## Notes
- The token must have `ADMIN` or `EDITOR` role in the active workspace, otherwise PATCH will fail.
- If the active workspace has no assignments, create a few in UI or run `POST /api/demo/seed` (requires editor/admin).
- For stable results, run from a separate machine/network and avoid running other heavy jobs on the server.

Traffic metrics:
- k6 summary includes `data_received` / `data_sent`.
