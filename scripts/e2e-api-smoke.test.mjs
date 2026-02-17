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

test('API e2e smoke: assignment curve persists and updates timeline aggregates', async () => {
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
  const projectCode = `E2E-CURVE-${Date.now()}`;
  const projectStart = `${year}-05-01T00:00:00.000Z`;
  const projectEnd = `${year}-05-31T00:00:00.000Z`;
  const assignmentStart = `${year}-05-05T00:00:00.000Z`;
  const assignmentEnd = `${year}-05-20T00:00:00.000Z`;

  let createdProjectId = null;
  let createdAssignmentId = null;

  try {
    const createdProject = await request('/projects', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        code: projectCode,
        name: `Curve ${projectCode}`,
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
        allocationPercent: 20,
      }),
    });
    assert.equal(createdAssignment.response.status, 201, 'assignment create endpoint should return 201');
    createdAssignmentId = createdAssignment.payload.id;

    const beforeTimeline = await request(`/timeline/year?year=${year}`, { headers: authHeaders });
    assert.equal(beforeTimeline.response.status, 200, 'timeline endpoint should return 200');
    const beforeRow = beforeTimeline.payload.find((row) => row.id === createdProjectId);
    assert.ok(beforeRow, 'timeline should include created project row');
    const beforeAllocation = Number(beforeRow.totalAllocationPercent);
    assert.ok(Number.isFinite(beforeAllocation), 'baseline timeline allocation should be numeric');

    const updateCurve = await request(`/assignments/${createdAssignmentId}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        loadProfile: {
          mode: 'curve',
          points: [
            { date: assignmentStart, value: 100 },
            { date: assignmentEnd, value: 100 },
          ],
        },
      }),
    });
    assert.equal(updateCurve.response.status, 200, 'assignment curve update endpoint should return 200');

    const projectDetail = await request(`/projects/${createdProjectId}`, { headers: authHeaders });
    assert.equal(projectDetail.response.status, 200, 'project detail endpoint should return 200');
    const updatedAssignment = (projectDetail.payload?.assignments ?? []).find((item) => item.id === createdAssignmentId);
    assert.ok(updatedAssignment, 'project detail should include updated assignment');
    assert.equal(updatedAssignment.loadProfile?.mode, 'curve', 'assignment should persist curve mode');
    assert.ok(Array.isArray(updatedAssignment.loadProfile?.points), 'assignment should persist curve points array');
    assert.equal(updatedAssignment.loadProfile.points.length >= 2, true, 'curve profile should keep at least two points');

    const afterTimeline = await request(`/timeline/year?year=${year}`, { headers: authHeaders });
    assert.equal(afterTimeline.response.status, 200, 'timeline endpoint should return 200 after curve update');
    const afterRow = afterTimeline.payload.find((row) => row.id === createdProjectId);
    assert.ok(afterRow, 'timeline should include created project row after curve update');
    const afterAllocation = Number(afterRow.totalAllocationPercent);
    assert.ok(Number.isFinite(afterAllocation), 'updated timeline allocation should be numeric');
    assert.ok(
      afterAllocation > beforeAllocation + 50,
      `curve update should materially increase allocation (${beforeAllocation} -> ${afterAllocation})`,
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

test('API e2e smoke: assignment load profile flat-curve-flat transition recalculates timeline', async () => {
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
  const projectCode = `E2E-FCF-${Date.now()}`;
  const projectStart = `${year}-06-01T00:00:00.000Z`;
  const projectEnd = `${year}-06-30T00:00:00.000Z`;
  const assignmentStart = `${year}-06-05T00:00:00.000Z`;
  const assignmentEnd = `${year}-06-20T00:00:00.000Z`;

  let createdProjectId = null;
  let createdAssignmentId = null;

  try {
    const createdProject = await request('/projects', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        code: projectCode,
        name: `FlatCurveFlat ${projectCode}`,
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
        allocationPercent: 30,
      }),
    });
    assert.equal(createdAssignment.response.status, 201, 'assignment create endpoint should return 201');
    createdAssignmentId = createdAssignment.payload.id;

    const beforeTimeline = await request(`/timeline/year?year=${year}`, { headers: authHeaders });
    assert.equal(beforeTimeline.response.status, 200, 'timeline endpoint should return 200 before updates');
    const beforeRow = beforeTimeline.payload.find((row) => row.id === createdProjectId);
    assert.ok(beforeRow, 'timeline should include created project row');
    const beforeAllocation = Number(beforeRow.totalAllocationPercent);

    const setCurve = await request(`/assignments/${createdAssignmentId}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        loadProfile: {
          mode: 'curve',
          points: [
            { date: assignmentStart, value: 100 },
            { date: assignmentEnd, value: 100 },
          ],
        },
      }),
    });
    assert.equal(setCurve.response.status, 200, 'curve update endpoint should return 200');

    const afterCurveTimeline = await request(`/timeline/year?year=${year}`, { headers: authHeaders });
    assert.equal(afterCurveTimeline.response.status, 200, 'timeline endpoint should return 200 after curve update');
    const afterCurveRow = afterCurveTimeline.payload.find((row) => row.id === createdProjectId);
    assert.ok(afterCurveRow, 'timeline should include created project row after curve update');
    const afterCurveAllocation = Number(afterCurveRow.totalAllocationPercent);
    assert.ok(
      afterCurveAllocation > beforeAllocation + 40,
      `curve should materially increase allocation (${beforeAllocation} -> ${afterCurveAllocation})`,
    );

    const setFlat = await request(`/assignments/${createdAssignmentId}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        allocationPercent: 40,
        loadProfile: {
          mode: 'flat',
        },
      }),
    });
    assert.equal(setFlat.response.status, 200, 'flat update endpoint should return 200');

    const projectDetail = await request(`/projects/${createdProjectId}`, { headers: authHeaders });
    assert.equal(projectDetail.response.status, 200, 'project detail endpoint should return 200');
    const updatedAssignment = (projectDetail.payload?.assignments ?? []).find((item) => item.id === createdAssignmentId);
    assert.ok(updatedAssignment, 'project detail should include assignment after flat update');
    assert.equal(updatedAssignment.loadProfile?.mode, 'flat', 'assignment should persist flat mode');

    const afterFlatTimeline = await request(`/timeline/year?year=${year}`, { headers: authHeaders });
    assert.equal(afterFlatTimeline.response.status, 200, 'timeline endpoint should return 200 after flat update');
    const afterFlatRow = afterFlatTimeline.payload.find((row) => row.id === createdProjectId);
    assert.ok(afterFlatRow, 'timeline should include created project row after flat update');
    const afterFlatAllocation = Number(afterFlatRow.totalAllocationPercent);
    assert.ok(
      afterFlatAllocation < afterCurveAllocation - 40,
      `flat should materially reduce allocation (${afterCurveAllocation} -> ${afterFlatAllocation})`,
    );
    assert.ok(
      Math.abs(afterFlatAllocation - 40) <= 0.5,
      `flat allocation should return near explicit value (expected 40, got ${afterFlatAllocation})`,
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

test('API e2e smoke: auth project member role update and removal', async () => {
  const loginOwner = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  assert.equal(loginOwner.response.status, 201, 'owner login endpoint should return 201');
  assert.equal(typeof loginOwner.payload?.accessToken, 'string', 'owner login should return accessToken');

  const ownerHeaders = {
    Authorization: `Bearer ${loginOwner.payload.accessToken}`,
    'Content-Type': 'application/json',
  };

  const seed = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const invitedEmail = `e2e-member-${seed}@projo.local`;
  const invitedPassword = `E2eMember!${seed}`;

  const invitedRegister = await request('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: invitedEmail,
      fullName: `E2E Member ${seed}`,
      password: invitedPassword,
    }),
  });
  assert.equal(invitedRegister.response.status, 201, 'invited user register should return 201');
  assert.equal(typeof invitedRegister.payload?.user?.id, 'string', 'invited user id should be available');

  const createProjectSpace = await request('/auth/projects', {
    method: 'POST',
    headers: ownerHeaders,
    body: JSON.stringify({ name: `E2E Project Space ${seed}` }),
  });
  assert.equal(createProjectSpace.response.status, 201, 'project-space create should return 201');

  const ownerProjectToken = createProjectSpace.payload?.accessToken;
  assert.equal(typeof ownerProjectToken, 'string', 'project-space create should return updated access token');

  const ownerProjectHeaders = {
    Authorization: `Bearer ${ownerProjectToken}`,
    'Content-Type': 'application/json',
  };
  const projectId = createProjectSpace.payload?.user?.workspaceId;
  assert.equal(typeof projectId, 'string', 'created project-space id should be available via workspaceId');

  const invite = await request(`/auth/projects/${projectId}/invite`, {
    method: 'POST',
    headers: ownerProjectHeaders,
    body: JSON.stringify({ email: invitedEmail, permission: 'editor' }),
  });
  assert.equal(invite.response.status, 201, 'invite should return 201');
  assert.ok(
    Array.isArray(invite.payload?.members) && invite.payload.members.some((item) => item.email === invitedEmail.toLowerCase() && item.role === 'PM'),
    'invite response should include invited member with PM role',
  );

  const invitedUserId = invite.payload.members.find((item) => item.email === invitedEmail.toLowerCase())?.userId;
  assert.equal(typeof invitedUserId, 'string', 'invited member userId should be present');

  const updateRole = await request(`/auth/projects/${projectId}/members/${invitedUserId}`, {
    method: 'PATCH',
    headers: ownerProjectHeaders,
    body: JSON.stringify({ permission: 'viewer' }),
  });
  assert.equal(updateRole.response.status, 200, 'member permission update should return 200');
  assert.ok(
    Array.isArray(updateRole.payload?.members) && updateRole.payload.members.some((item) => item.userId === invitedUserId && item.role === 'VIEWER'),
    'updated member should have VIEWER role',
  );

  const removeMember = await request(`/auth/projects/${projectId}/members/${invitedUserId}`, {
    method: 'DELETE',
    headers: ownerProjectHeaders,
  });
  assert.equal(removeMember.response.status, 200, 'member removal should return 200');
  assert.ok(
    Array.isArray(removeMember.payload?.members) && !removeMember.payload.members.some((item) => item.userId === invitedUserId),
    'removed member should not be present in members response',
  );
});

test('API e2e smoke: company list/create/rename/switch lifecycle', async () => {
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

  const beforeCompanies = await request('/auth/companies', { headers: authHeaders });
  assert.equal(beforeCompanies.response.status, 200, 'companies endpoint should return 200');
  assert.equal(typeof beforeCompanies.payload?.activeCompanyId, 'string', 'active company id should be present');
  assert.ok(Array.isArray(beforeCompanies.payload?.companies), 'companies payload should be array');
  assert.ok(beforeCompanies.payload.companies.length >= 1, 'user should have at least one company');

  const companyName = `E2E Company ${Date.now()}`;
  const createCompany = await request('/auth/companies', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ name: companyName }),
  });
  assert.equal(createCompany.response.status, 201, 'create company should return 201');
  assert.equal(typeof createCompany.payload?.accessToken, 'string', 'create company should return new accessToken');

  const createdToken = createCompany.payload.accessToken;
  const createdHeaders = {
    Authorization: `Bearer ${createdToken}`,
    'Content-Type': 'application/json',
  };

  const afterCreateCompanies = await request('/auth/companies', { headers: createdHeaders });
  assert.equal(afterCreateCompanies.response.status, 200, 'companies endpoint should return 200 after create');
  const createdCompany = afterCreateCompanies.payload?.companies?.find((item) => item.name === companyName);
  assert.ok(createdCompany, 'newly created company should exist in companies list');
  assert.equal(afterCreateCompanies.payload?.activeCompanyId, createdCompany.id, 'created company should become active');

  const renamedCompanyName = `${companyName} Updated`;
  const renameCompany = await request(`/auth/companies/${createdCompany.id}`, {
    method: 'PATCH',
    headers: createdHeaders,
    body: JSON.stringify({ name: renamedCompanyName }),
  });
  assert.equal(renameCompany.response.status, 200, 'rename company should return 200');
  assert.equal(renameCompany.payload?.name, renamedCompanyName, 'renamed company should return updated name');

  const switchCompany = await request('/auth/companies/switch', {
    method: 'POST',
    headers: createdHeaders,
    body: JSON.stringify({ companyId: createdCompany.id }),
  });
  assert.equal(switchCompany.response.status, 201, 'switch company should return 201');
  assert.equal(typeof switchCompany.payload?.accessToken, 'string', 'switch company should return new accessToken');

  const switchedHeaders = {
    Authorization: `Bearer ${switchCompany.payload.accessToken}`,
    'Content-Type': 'application/json',
  };
  const afterSwitchCompanies = await request('/auth/companies', { headers: switchedHeaders });
  assert.equal(afterSwitchCompanies.response.status, 200, 'companies endpoint should return 200 after switch');
  assert.equal(afterSwitchCompanies.payload?.activeCompanyId, createdCompany.id, 'active company should match switched company');
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
