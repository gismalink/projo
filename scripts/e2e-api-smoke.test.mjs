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

function shiftIsoByDays(iso, days) {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

async function ensureEmployee(authHeaders) {
  const employees = await request('/employees', { headers: authHeaders });
  assert.equal(employees.response.status, 200, 'employees endpoint should return 200');
  assert.ok(Array.isArray(employees.payload), 'employees payload should be an array');

  if (employees.payload.length > 0) {
    return employees.payload[0];
  }

  const roles = await request('/roles', { headers: authHeaders });
  assert.equal(roles.response.status, 200, 'roles endpoint should return 200');
  assert.ok(Array.isArray(roles.payload), 'roles payload should be an array');
  assert.ok(roles.payload.length > 0, 'roles payload should not be empty');

  const seed = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const createdEmployee = await request('/employees', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      fullName: `Smoke Employee ${seed}`,
      email: `smoke-employee-${seed}@projo.local`,
      roleId: roles.payload[0].id,
    }),
  });

  assert.equal(createdEmployee.response.status, 201, 'employee create endpoint should return 201');
  return createdEmployee.payload;
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

  const employee = await ensureEmployee(authHeaders);
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

test('API e2e smoke: project shift/resize keeps assignment flow consistent', async () => {
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

  const employee = await ensureEmployee(authHeaders);
  const projectCode = `E2E-SHIFT-${Date.now()}`;

  const projectStart = `${year}-04-01T00:00:00.000Z`;
  const projectEnd = `${year}-04-30T00:00:00.000Z`;
  const assignmentStart = `${year}-04-07T00:00:00.000Z`;
  const assignmentEnd = `${year}-04-18T00:00:00.000Z`;

  let createdProjectId = null;
  let createdAssignmentId = null;

  try {
    const createdProject = await request('/projects', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        code: projectCode,
        name: `Shift ${projectCode}`,
        startDate: projectStart,
        endDate: projectEnd,
        status: 'planned',
        priority: 2,
        links: [],
      }),
    });
    assert.equal(createdProject.response.status, 201, 'project create endpoint should return 201');
    createdProjectId = createdProject.payload.id;

    const createdAssignment = await request('/assignments', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        projectId: createdProjectId,
        employeeId: employee.id,
        assignmentStartDate: assignmentStart,
        assignmentEndDate: assignmentEnd,
        allocationPercent: 75,
      }),
    });
    assert.equal(createdAssignment.response.status, 201, 'assignment create endpoint should return 201');
    createdAssignmentId = createdAssignment.payload.id;

    const shiftDays = 7;
    const nextProjectStart = shiftIsoByDays(projectStart, shiftDays);
    const nextProjectEnd = shiftIsoByDays(projectEnd, shiftDays + 3);
    const nextAssignmentStart = shiftIsoByDays(assignmentStart, shiftDays);
    const nextAssignmentEnd = shiftIsoByDays(assignmentEnd, shiftDays);

    const updateProject = await request(`/projects/${createdProjectId}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        startDate: nextProjectStart,
        endDate: nextProjectEnd,
      }),
    });
    assert.equal(updateProject.response.status, 200, 'project update endpoint should return 200');

    const updateAssignment = await request(`/assignments/${createdAssignmentId}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        assignmentStartDate: nextAssignmentStart,
        assignmentEndDate: nextAssignmentEnd,
      }),
    });
    assert.equal(updateAssignment.response.status, 200, 'assignment update endpoint should return 200');

    const projectDetail = await request(`/projects/${createdProjectId}`, { headers: authHeaders });
    assert.equal(projectDetail.response.status, 200, 'project detail endpoint should return 200');

    const updatedAssignment = (projectDetail.payload?.assignments ?? []).find(
      (assignment) => assignment.id === createdAssignmentId,
    );
    assert.ok(updatedAssignment, 'project detail should include updated assignment');
    assert.equal(
      new Date(updatedAssignment.assignmentStartDate).toISOString(),
      new Date(nextAssignmentStart).toISOString(),
      'assignment start date should match shifted value',
    );
    assert.equal(
      new Date(updatedAssignment.assignmentEndDate).toISOString(),
      new Date(nextAssignmentEnd).toISOString(),
      'assignment end date should match shifted value',
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

test('API e2e smoke: account register + me + password change', async () => {
  const seed = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const accountEmail = `e2e-user-${seed}@projo.local`;
  const initialPassword = `E2ePass!${seed}`;
  const nextPassword = `E2eNext!${seed}`;
  const accountName = `E2E User ${seed}`;

  const register = await request('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: accountEmail,
      fullName: accountName,
      password: initialPassword,
    }),
  });

  if (register.response.status === 404) {
    return;
  }

  assert.equal(register.response.status, 201, 'register endpoint should return 201');
  assert.equal(typeof register.payload?.accessToken, 'string', 'register should return accessToken');
  assert.equal(register.payload?.user?.role, 'VIEWER', 'newly registered user should have VIEWER role');

  const authHeaders = {
    Authorization: `Bearer ${register.payload.accessToken}`,
    'Content-Type': 'application/json',
  };

  const me = await request('/auth/me', { headers: authHeaders });
  assert.equal(me.response.status, 200, 'auth/me should return 200');
  assert.equal(me.payload?.email, accountEmail.toLowerCase(), 'auth/me should return normalized email');

  const updatedName = `${accountName} Updated`;
  const updateMe = await request('/auth/me', {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ fullName: updatedName }),
  });
  assert.equal(updateMe.response.status, 200, 'auth/me PATCH should return 200');
  assert.equal(updateMe.payload?.fullName, updatedName, 'profile update should persist fullName');

  const changePassword = await request('/auth/change-password', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ currentPassword: initialPassword, newPassword: nextPassword }),
  });
  assert.equal(changePassword.response.status, 201, 'change-password endpoint should return 201');
  assert.equal(changePassword.payload?.success, true, 'change-password should return success=true');

  const relogin = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: accountEmail, password: nextPassword }),
  });
  assert.equal(relogin.response.status, 201, 'login with updated password should return 201');
  assert.equal(typeof relogin.payload?.accessToken, 'string', 'login after password change should return accessToken');
});
