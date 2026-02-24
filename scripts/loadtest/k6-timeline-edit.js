import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.PROJO_BASE_URL || 'https://test.projo.gismalink.art';
const JWT = __ENV.PROJO_JWT;
const YEAR = __ENV.PROJO_YEAR || String(new Date().getUTCFullYear());
const EDIT_RATIO = Number(__ENV.PROJO_EDIT_RATIO || '0.4');

export const options = {
  scenarios: {
    timeline_edit: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 5 },
        { duration: '1m', target: 10 },
        { duration: '1m', target: 25 },
        { duration: '1m', target: 50 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000'],
  },
};

function authHeaders() {
  if (!JWT) {
    throw new Error('PROJO_JWT is required (get it from /api/sso/get-token response in browser DevTools).');
  }

  return {
    authorization: `Bearer ${JWT}`,
    accept: 'application/json',
  };
}

function pickRandom(values) {
  return values[Math.floor(Math.random() * values.length)];
}

export function setup() {
  const headers = authHeaders();

  const list = http.get(`${BASE_URL}/api/assignments`, { headers });
  check(list, {
    'setup: list assignments 200': (r) => r.status === 200,
  });

  const parsed = list.json();
  const assignmentIds = Array.isArray(parsed)
    ? parsed
        .map((row) => (row && typeof row === 'object' ? row.id : null))
        .filter((id) => typeof id === 'string' && id.length > 0)
    : [];

  if (assignmentIds.length === 0) {
    throw new Error(
      'No assignments found in the active workspace. Create some assignments (or run /api/demo/seed) and retry.',
    );
  }

  return { assignmentIds };
}

export default function (data) {
  const headers = authHeaders();

  const timeline = http.get(`${BASE_URL}/api/timeline/year?year=${encodeURIComponent(YEAR)}`, {
    headers,
    tags: { name: 'GET /api/timeline/year' },
  });
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

    check(patch, {
      'patch 200': (r) => r.status === 200,
    });
  }

  sleep(0.5);
}
