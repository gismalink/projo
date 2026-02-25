import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const BASE_URL = __ENV.PROJO_BASE_URL || 'https://test.projo.gismalink.art';
const YEAR = __ENV.PROJO_YEAR || '2026';
const EDIT_RATIO = Number(__ENV.PROJO_EDIT_RATIO || '0.45');
const SLEEP_SEC = Number(__ENV.PROJO_SLEEP || '0.22');
const TOKEN_FILE = __ENV.PROJO_TOKEN_FILE;
const PEAK_VU = Number(__ENV.PROJO_PEAK_VU || '400');
const MID_VU = Number(__ENV.PROJO_MID_VU || String(Math.round(PEAK_VU * 0.8)));
const LOW_VU = Number(__ENV.PROJO_LOW_VU || String(Math.round(PEAK_VU * 0.55)));
const STAGE_UP_1 = __ENV.PROJO_STAGE_UP_1 || '2m';
const STAGE_UP_2 = __ENV.PROJO_STAGE_UP_2 || '3m';
const STAGE_PEAK = __ENV.PROJO_STAGE_PEAK || '4m';
const STAGE_DOWN_1 = __ENV.PROJO_STAGE_DOWN_1 || '3m';
const STAGE_DOWN_2 = __ENV.PROJO_STAGE_DOWN_2 || '2m';
const STAGE_COOLDOWN = __ENV.PROJO_STAGE_COOLDOWN || '1m';

if (!TOKEN_FILE) throw new Error('PROJO_TOKEN_FILE is required');
const TOKENS = open(TOKEN_FILE)
  .split(/\r?\n/)
  .map((s) => s.trim())
  .filter((s) => s.length > 0);
if (TOKENS.length === 0) throw new Error('Token file is empty');

const s2xx = new Counter('status_2xx');
const s401 = new Counter('status_401');
const s403 = new Counter('status_403');
const s404 = new Counter('status_404');
const s409 = new Counter('status_409');
const s429 = new Counter('status_429');
const s5xx = new Counter('status_5xx');
const sOther = new Counter('status_other');

export const options = {
  scenarios: {
    timeline_edit: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: STAGE_UP_1, target: LOW_VU },
        { duration: STAGE_UP_2, target: MID_VU },
        { duration: STAGE_PEAK, target: PEAK_VU },
        { duration: STAGE_DOWN_1, target: MID_VU },
        { duration: STAGE_DOWN_2, target: LOW_VU },
        { duration: STAGE_COOLDOWN, target: 0 },
      ],
      gracefulRampDown: '20s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<3000'],
  },
};

function tokenForVU() {
  const idx = (__VU - 1) % TOKENS.length;
  return TOKENS[idx];
}

function headersForVU() {
  return {
    authorization: `Bearer ${tokenForVU()}`,
    accept: 'application/json',
  };
}

function markStatus(status) {
  if (status >= 200 && status < 300) s2xx.add(1);
  else if (status === 401) s401.add(1);
  else if (status === 403) s403.add(1);
  else if (status === 404) s404.add(1);
  else if (status === 409) s409.add(1);
  else if (status === 429) s429.add(1);
  else if (status >= 500) s5xx.add(1);
  else sOther.add(1);
}

function pickRandom(values) {
  return values[Math.floor(Math.random() * values.length)];
}

export function setup() {
  const headers = {
    authorization: `Bearer ${TOKENS[0]}`,
    accept: 'application/json',
  };

  const list = http.get(`${BASE_URL}/api/assignments`, { headers, tags: { name: 'GET /api/assignments' } });
  markStatus(list.status);
  check(list, {
    'setup assignments 200': (r) => r.status === 200,
  });

  const parsed = list.json();
  const assignmentIds = Array.isArray(parsed)
    ? parsed
        .map((row) => (row && typeof row === 'object' ? row.id : null))
        .filter((id) => typeof id === 'string' && id.length > 0)
    : [];

  if (assignmentIds.length === 0) {
    throw new Error('No assignments in workspace');
  }

  return { assignmentIds };
}

export default function (data) {
  const headers = headersForVU();

  const timeline = http.get(`${BASE_URL}/api/timeline/year?year=${encodeURIComponent(YEAR)}`, {
    headers,
    tags: { name: 'GET /api/timeline/year' },
  });
  markStatus(timeline.status);
  check(timeline, {
    'timeline 200': (r) => r.status === 200,
  });

  if (Math.random() < EDIT_RATIO) {
    const assignmentId = pickRandom(data.assignmentIds);
    const nextPercent = Math.round(10 + Math.random() * 90);

    const patch = http.patch(
      `${BASE_URL}/api/assignments/${encodeURIComponent(assignmentId)}`,
      JSON.stringify({ allocationPercent: nextPercent }),
      {
        headers: {
          ...headers,
          'content-type': 'application/json',
        },
        tags: { name: 'PATCH /api/assignments/:id' },
      },
    );

    markStatus(patch.status);
    check(patch, {
      'patch 200': (r) => r.status === 200,
    });
  }

  sleep(SLEEP_SEC);
}
