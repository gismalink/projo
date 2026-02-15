const baseUrl = process.env.PROFILE_API_URL ?? 'http://localhost:4000/api';
const email = process.env.PROFILE_USER_EMAIL ?? 'admin@projo.local';
const password = process.env.PROFILE_USER_PASSWORD ?? 'ProjoAdmin!2026';
const year = Number(process.env.PROFILE_YEAR ?? new Date().getUTCFullYear());
const rounds = Number(process.env.PROFILE_ROUNDS ?? 10);

function hrMs(start) {
  const diff = process.hrtime.bigint() - start;
  return Number(diff) / 1_000_000;
}

async function timedFetch(url, options) {
  const started = process.hrtime.bigint();
  const response = await fetch(url, options);
  const elapsedMs = hrMs(started);
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  return { response, elapsedMs, payload };
}

function summarize(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, n) => acc + n, 0);
  const avg = sum / sorted.length;
  const p95Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  return {
    minMs: Number(sorted[0].toFixed(2)),
    avgMs: Number(avg.toFixed(2)),
    p95Ms: Number(sorted[p95Index].toFixed(2)),
    maxMs: Number(sorted[sorted.length - 1].toFixed(2)),
  };
}

async function main() {
  const health = await timedFetch(`${baseUrl}/health`);
  if (!health.response.ok) {
    throw new Error(`health check failed: ${health.response.status}`);
  }

  const login = await timedFetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!login.response.ok || !login.payload?.accessToken) {
    throw new Error(`login failed: ${login.response.status}`);
  }

  const authHeaders = { Authorization: `Bearer ${login.payload.accessToken}` };

  const endpoints = [
    `/timeline/year?year=${year}`,
    `/calendar/${year}`,
    '/calendar/health/status',
  ];

  const report = {};

  for (const endpoint of endpoints) {
    const samples = [];
    for (let i = 0; i < rounds; i += 1) {
      const sample = await timedFetch(`${baseUrl}${endpoint}`, { headers: authHeaders });
      if (!sample.response.ok) {
        throw new Error(`${endpoint} failed: ${sample.response.status}`);
      }
      samples.push(sample.elapsedMs);
    }
    report[endpoint] = summarize(samples);
  }

  console.log(JSON.stringify({ baseUrl, year, rounds, report }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
