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

test('API e2e smoke: project member + assignment consistency', async () => {
  const login = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  assert.equal(login.response.status, 201, 'login endpoint should return 201');
  assert.equal(typeof login.payload?.accessToken, 'string', 'login should return accessToken');

  const authHeaders = {
    Authorization: `Bearer ${login.payload.accessToken}`,
    'Content-Type': 'application/json',
  };

  const employees = await request('/employees', { headers: authHeaders });
  assert.equal(employees.response.status, 200, 'employees endpoint should return 200');
  assert.ok(Array.isArray(employees.payload), 'employees payload should be an array');
  assert.ok(employees.payload.length > 0, 'employees payload should not be empty');

  const employee = employees.payload[0];
  assert.equal(typeof employee?.id, 'string', 'employee id should be available');

  const startDate = `${year}-02-01T00:00:00.000Z`;
  const endDate = `${year}-02-28T00:00:00.000Z`;
  const assignmentStartDate = `${year}-02-03T00:00:00.000Z`;
  const assignmentEndDate = `${year}-02-21T00:00:00.000Z`;
  const projectCode = `E2E-${Date.now()}`;

  let createdProjectId = null;
  let createdAssignmentId = null;

  try {
    const createdProject = await request('/projects', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        code: projectCode,
        name: `Smoke ${projectCode}`,
        startDate,
        endDate,
        status: 'planned',
        priority: 2,
        links: [],
      }),
    });

    assert.equal(createdProject.response.status, 201, 'project create endpoint should return 201');
    assert.equal(typeof createdProject.payload?.id, 'string', 'created project should contain id');
    createdProjectId = createdProject.payload.id;

    const addMember = await request(`/projects/${createdProjectId}/members`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ employeeId: employee.id }),
    });
    assert.equal(addMember.response.status, 201, 'add member endpoint should return 201');

    const createdAssignment = await request('/assignments', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        projectId: createdProjectId,
        employeeId: employee.id,
        assignmentStartDate,
        assignmentEndDate,
        allocationPercent: 50,
      }),
    });

    assert.equal(createdAssignment.response.status, 201, 'assignment create endpoint should return 201');
    assert.equal(typeof createdAssignment.payload?.id, 'string', 'created assignment should contain id');
    createdAssignmentId = createdAssignment.payload.id;

    const duplicateAssignment = await request('/assignments', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        projectId: createdProjectId,
        employeeId: employee.id,
        assignmentStartDate,
        assignmentEndDate,
        allocationPercent: 60,
      }),
    });

    assert.equal(duplicateAssignment.response.status, 409, 'duplicate assignment should return 409');
    const duplicateMessage =
      typeof duplicateAssignment.payload?.message === 'string'
        ? duplicateAssignment.payload.message
        : Array.isArray(duplicateAssignment.payload?.message)
          ? duplicateAssignment.payload.message.join(' | ')
          : '';
    assert.ok(
      duplicateMessage.includes('ERR_ASSIGNMENT_EMPLOYEE_ALREADY_IN_PROJECT'),
      'duplicate assignment should include conflict error code',
    );

    const invalidDateAssignment = await request('/assignments', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        projectId: createdProjectId,
        employeeId: employee.id,
        assignmentStartDate: `${year}-03-10T00:00:00.000Z`,
        assignmentEndDate: `${year}-03-01T00:00:00.000Z`,
        allocationPercent: 30,
      }),
    });

    assert.equal(invalidDateAssignment.response.status, 400, 'invalid assignment date range should return 400');
    const invalidDateMessage =
      typeof invalidDateAssignment.payload?.message === 'string'
        ? invalidDateAssignment.payload.message
        : Array.isArray(invalidDateAssignment.payload?.message)
          ? invalidDateAssignment.payload.message.join(' | ')
          : '';
    assert.ok(
      invalidDateMessage.includes('ERR_ASSIGNMENT_DATE_RANGE_INVALID'),
      'invalid date assignment should include validation error code',
    );

    const projectMembers = await request(`/projects/${createdProjectId}/members`, { headers: authHeaders });
    assert.equal(projectMembers.response.status, 200, 'project members endpoint should return 200');
    assert.ok(Array.isArray(projectMembers.payload), 'project members payload should be array');
    assert.ok(
      projectMembers.payload.some((member) => member.employeeId === employee.id),
      'project members should include selected employee',
    );

    const projectDetail = await request(`/projects/${createdProjectId}`, { headers: authHeaders });
    assert.equal(projectDetail.response.status, 200, 'project details endpoint should return 200');
    assert.ok(Array.isArray(projectDetail.payload?.assignments), 'project detail assignments should be array');
    assert.ok(
      projectDetail.payload.assignments.some((assignment) => assignment.id === createdAssignmentId),
      'project detail should include created assignment',
    );
  } finally {
    if (createdAssignmentId) {
      await request(`/assignments/${createdAssignmentId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
    }

    if (createdProjectId) {
      await request(`/projects/${createdProjectId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
    }
  }
});
