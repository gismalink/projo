import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.PROJO_BASE_URL || 'https://test.projo.gismalink.art';
const JWT = __ENV.PROJO_JWT;
const YEAR = __ENV.PROJO_YEAR || String(new Date().getUTCFullYear());

const THINK_TIME_S = Number(__ENV.PROJO_THINK_TIME_S || '0.8');
const EDIT_RATIO = Number(__ENV.PROJO_EDIT_RATIO || '0.3');

function authHeaders() {
  if (!JWT) {
    throw new Error('PROJO_JWT is required (get it from /api/sso/get-token response in browser DevTools).');
  }

  return {
    authorization: `Bearer ${JWT}`,
    accept: 'application/json',
  };
}

function uniq(list) {
  return Array.from(new Set(list));
}

function extractAssetUrls(html) {
  // Minimal parsing: look for /assets/*.js and /assets/*.css references.
  const matches = [];

  const patterns = [
    /\b(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g,
    /\b(?:src|href)='(\/assets\/[^"]+\.(?:js|css))'/g,
  ];

  for (const re of patterns) {
    for (;;) {
      const m = re.exec(html);
      if (!m) break;
      matches.push(m[1]);
    }
  }

  return uniq(matches).map((p) => (p.startsWith('http') ? p : `${BASE_URL}${p}`));
}

function pickRandom(values) {
  return values[Math.floor(Math.random() * values.length)];
}

export const options = {
  scenarios: {
    user_journey: {
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
    http_req_duration: ['p(95)<2500'],
  },
};

export function setup() {
  const headers = authHeaders();

  // Preload assignment ids once to avoid calling list every iteration.
  const list = http.get(`${BASE_URL}/api/assignments`, { headers });
  check(list, { 'setup: list assignments 200': (r) => r.status === 200 });

  const parsed = list.json();
  const assignmentIds = Array.isArray(parsed)
    ? parsed
        .map((row) => (row && typeof row === 'object' ? row.id : null))
        .filter((id) => typeof id === 'string' && id.length > 0)
    : [];

  if (assignmentIds.length === 0) {
    throw new Error('No assignments found in the active workspace. Create some assignments and retry.');
  }

  return { assignmentIds };
}

export default function (data) {
  // 1) Browser-like: load index.html and main assets.
  const index = http.get(`${BASE_URL}/`, {
    headers: { accept: 'text/html' },
    tags: { name: 'GET /' },
  });

  check(index, {
    'index 200|30x': (r) => r.status === 200 || r.status === 301 || r.status === 302,
  });

  // Follow redirect once (common for http->https or apex->www).
  const indexHtml = index.status === 200 ? index.body : '';

  if (indexHtml) {
    const assets = extractAssetUrls(indexHtml);
    for (const url of assets) {
      const asset = http.get(url, {
        tags: { name: 'GET /assets/*' },
      });
      check(asset, { 'asset 200': (r) => r.status === 200 });
    }
  }

  sleep(THINK_TIME_S);

  // 2) API bootstrap-like calls.
  const headers = authHeaders();

  const me = http.get(`${BASE_URL}/api/auth/me`, {
    headers,
    tags: { name: 'GET /api/auth/me' },
  });
  check(me, { 'me 200': (r) => r.status === 200 });

  const companies = http.get(`${BASE_URL}/api/auth/companies`, {
    headers,
    tags: { name: 'GET /api/auth/companies' },
  });
  check(companies, { 'companies 200': (r) => r.status === 200 });

  const projects = http.get(`${BASE_URL}/api/auth/projects`, {
    headers,
    tags: { name: 'GET /api/auth/projects' },
  });
  check(projects, { 'projects 200': (r) => r.status === 200 });

  sleep(THINK_TIME_S);

  const assignments = http.get(`${BASE_URL}/api/assignments`, {
    headers,
    tags: { name: 'GET /api/assignments' },
  });
  check(assignments, { 'assignments 200': (r) => r.status === 200 });

  const timeline = http.get(`${BASE_URL}/api/timeline/year?year=${encodeURIComponent(YEAR)}`, {
    headers,
    tags: { name: 'GET /api/timeline/year' },
  });
  check(timeline, { 'timeline 200': (r) => r.status === 200 });

  sleep(THINK_TIME_S);

  // 3) Edit (sometimes).
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

    check(patch, { 'patch 200': (r) => r.status === 200 });
  }

  sleep(THINK_TIME_S);
}
