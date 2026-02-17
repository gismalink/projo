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

function toIsoDay(value) {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toISOString();
}

(async () => {
  const login = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (login.response.status !== 201) {
    console.error('Login failed:', login.payload);
    process.exit(1);
  }

  const authHeaders = {
    Authorization: `Bearer ${login.payload.accessToken}`,
    'Content-Type': 'application/json',
  };

  const assignmentsRes = await request('/assignments', { headers: authHeaders });
  if (assignmentsRes.response.status !== 200 || !Array.isArray(assignmentsRes.payload)) {
    console.error('Failed to load assignments:', assignmentsRes.payload);
    process.exit(1);
  }

  const targetAssignment = assignmentsRes.payload.find((assignment) => {
    const start = new Date(assignment.assignmentStartDate).getTime();
    const end = new Date(assignment.assignmentEndDate).getTime();
    return Number.isFinite(start) && Number.isFinite(end) && end > start;
  });

  if (!targetAssignment) {
    console.error('No suitable assignment found (needs at least 2 distinct dates).');
    process.exit(1);
  }

  const projectId = targetAssignment.projectId;
  const assignmentId = targetAssignment.id;
  const startIso = toIsoDay(targetAssignment.assignmentStartDate);
  const endIso = toIsoDay(targetAssignment.assignmentEndDate);
  const originalLoadProfile = targetAssignment.loadProfile ?? null;

  const timelineBefore = await request(`/timeline/year?year=${year}`, { headers: authHeaders });
  const rowBefore = Array.isArray(timelineBefore.payload)
    ? timelineBefore.payload.find((row) => row.id === projectId)
    : null;
  const beforeAllocation = rowBefore ? Number(rowBefore.totalAllocationPercent) : null;

  const updateCurve = await request(`/assignments/${assignmentId}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({
      loadProfile: {
        mode: 'curve',
        points: [
          { date: startIso, value: 100 },
          { date: endIso, value: 100 },
        ],
      },
    }),
  });

  if (updateCurve.response.status !== 200) {
    console.error('Curve update failed:', updateCurve.response.status, updateCurve.payload);
    process.exit(1);
  }

  const projectAfter = await request(`/projects/${projectId}`, { headers: authHeaders });
  const savedAssignment = Array.isArray(projectAfter.payload?.assignments)
    ? projectAfter.payload.assignments.find((assignment) => assignment.id === assignmentId)
    : null;

  const savedCurve = savedAssignment?.loadProfile;
  const curveSaved = Boolean(
    savedCurve &&
      savedCurve.mode === 'curve' &&
      Array.isArray(savedCurve.points) &&
      savedCurve.points.length >= 2,
  );

  const timelineAfter = await request(`/timeline/year?year=${year}`, { headers: authHeaders });
  const rowAfter = Array.isArray(timelineAfter.payload)
    ? timelineAfter.payload.find((row) => row.id === projectId)
    : null;
  const afterAllocation = rowAfter ? Number(rowAfter.totalAllocationPercent) : null;

  console.log('Probe result:');
  console.log('- assignmentId:', assignmentId);
  console.log('- projectId:', projectId);
  console.log('- curveSaved:', curveSaved);
  console.log('- allocationBefore:', beforeAllocation);
  console.log('- allocationAfter:', afterAllocation);
  if (beforeAllocation !== null && afterAllocation !== null) {
    console.log('- allocationDelta:', Number((afterAllocation - beforeAllocation).toFixed(2)));
  }

  const rollbackPayload = originalLoadProfile
    ? { loadProfile: originalLoadProfile }
    : { loadProfile: { mode: 'flat' }, allocationPercent: Number(targetAssignment.allocationPercent ?? 100) };

  const rollback = await request(`/assignments/${assignmentId}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify(rollbackPayload),
  });

  if (rollback.response.status !== 200) {
    console.error('Rollback failed:', rollback.response.status, rollback.payload);
    process.exit(1);
  }

  if (!curveSaved) {
    process.exit(2);
  }
})();
