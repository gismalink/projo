import assert from 'node:assert/strict';
import test from 'node:test';

const baseUrl = process.env.E2E_API_URL ?? 'http://localhost:4000/api';
const email = process.env.E2E_USER_EMAIL ?? 'admin@projo.local';
const password = process.env.E2E_USER_PASSWORD ?? 'ProjoAdmin!2026';
const year = Number(process.env.E2E_YEAR ?? new Date().getUTCFullYear());

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  return { response, payload };
}

test('API e2e smoke: auth + timeline + calendar', async () => {
  const health = await request('/health');
  assert.equal(health.response.status, 200, 'health endpoint should return 200');

  const login = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  assert.equal(login.response.status, 201, 'login endpoint should return 201');
  assert.equal(typeof login.payload?.accessToken, 'string', 'login should return accessToken');

  const authHeaders = { Authorization: `Bearer ${login.payload.accessToken}` };

  const timeline = await request(`/timeline/year?year=${year}`, { headers: authHeaders });
  assert.equal(timeline.response.status, 200, 'timeline endpoint should return 200');
  assert.ok(Array.isArray(timeline.payload), 'timeline payload should be an array');

  const calendar = await request(`/calendar/${year}`, { headers: authHeaders });
  assert.equal(calendar.response.status, 200, 'calendar endpoint should return 200');
  assert.equal(calendar.payload?.year, year, 'calendar response should match requested year');
  assert.ok(Array.isArray(calendar.payload?.days), 'calendar days payload should be an array');

  const calendarHealth = await request('/calendar/health/status', { headers: authHeaders });
  assert.equal(calendarHealth.response.status, 200, 'calendar health endpoint should return 200');
  assert.equal(typeof calendarHealth.payload?.currentYear?.freshness, 'string', 'calendar health should include freshness');
});
