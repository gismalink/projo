const baseUrl = process.env.SMOKE_API_URL ?? 'http://localhost:4000/api';
const email = process.env.SMOKE_USER_EMAIL ?? 'admin@projo.local';
const password = process.env.SMOKE_USER_PASSWORD ?? 'ProjoAdmin!2026';
const year = Number(process.env.SMOKE_YEAR ?? new Date().getUTCFullYear());

async function fetchJson(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  return { response, payload };
}

(async () => {
  const { response: healthResponse } = await fetchJson('/health');
  if (!healthResponse.ok) {
    throw new Error(`[smoke] /health failed: ${healthResponse.status}`);
  }

  const { response: loginResponse, payload: loginPayload } = await fetchJson('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!loginResponse.ok || !loginPayload?.accessToken) {
    throw new Error(`[smoke] /auth/login failed: ${loginResponse.status}`);
  }

  const authHeaders = { Authorization: `Bearer ${loginPayload.accessToken}` };
  const protectedEndpoints = [`/timeline/year?year=${year}`, `/calendar/${year}`, '/calendar/health/status'];

  for (const endpoint of protectedEndpoints) {
    const { response } = await fetchJson(endpoint, { headers: authHeaders });
    if (!response.ok) {
      throw new Error(`[smoke] ${endpoint} failed: ${response.status}`);
    }
  }

  console.log(`[smoke] api ok (${baseUrl})`);
})().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
