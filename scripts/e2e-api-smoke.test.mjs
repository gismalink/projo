import assert from 'node:assert/strict';
import test from 'node:test';

const baseUrl = process.env.E2E_API_URL ?? 'http://localhost:4000/api';
const email = process.env.E2E_USER_EMAIL ?? 'admin@projo.local';
const password = process.env.E2E_USER_PASSWORD ?? 'ProjoAdmin!2026';
const year = Number(process.env.E2E_YEAR ?? new Date().getUTCFullYear());
const authMode = (process.env.E2E_AUTH_MODE ?? 'auto').trim().toLowerCase();
const accessTokenOverride = (process.env.E2E_ACCESS_TOKEN ?? '').trim();
const suiteMode = (process.env.E2E_SUITE ?? 'all').trim().toLowerCase();

if (!new Set(['all', 'core', 'extended']).has(suiteMode)) {
  throw new Error(`Invalid E2E_SUITE="${suiteMode}". Expected one of: all, core, extended.`);
}

function smokeTest(name, tier, fn) {
  if (suiteMode !== 'all' && suiteMode !== tier) return;
  test(name, fn);
}

let apiAvailabilityChecked = false;
let apiAvailabilityError = '';

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

async function ensureApiAvailable(t) {
  if (!apiAvailabilityChecked) {
    apiAvailabilityChecked = true;
    try {
      const health = await request('/health');
      if (health.response.status !== 200) {
        apiAvailabilityError = `API health check failed at ${baseUrl}/health (status ${health.response.status}).`;
      }
    } catch (error) {
      apiAvailabilityError = `API is not reachable at ${baseUrl} (${error instanceof Error ? error.message : 'unknown error'}).`;
    }
  }

  if (apiAvailabilityError) {
    t.skip(apiAvailabilityError);
    return false;
  }

  return true;
}

function shiftIsoByDays(iso, days) {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

async function getAccessToken(t) {
  if (!(await ensureApiAvailable(t))) return null;

  if (accessTokenOverride) return accessTokenOverride;

  if (authMode === 'sso') {
    t.skip('SSO mode: set E2E_ACCESS_TOKEN to run authenticated API smoke.');
    return null;
  }

  const login = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (login.response.status === 410) {
    t.skip('Local auth is disabled (410). Set E2E_ACCESS_TOKEN (SSO) or run against a local/dev API.');
    return null;
  }

  if (login.response.status === 404) {
    t.skip(`Login endpoint is not available at ${baseUrl}/auth/login (404).`);
    return null;
  }

  assert.equal(login.response.status, 201, 'login endpoint should return 201');
  assert.equal(typeof login.payload?.accessToken, 'string', 'login should return accessToken');
  return login.payload.accessToken;
}

async function getAuthHeaders(t, options = {}) {
  const token = await getAccessToken(t);
  if (!token) return null;

  const headers = {
    Authorization: `Bearer ${token}`,
  };

  if (options.json) {
    headers['Content-Type'] = 'application/json';
  }

  return headers;
}

async function findReusableEmployeeFromWorkspace(authHeaders) {
  const projects = await request('/projects', { headers: authHeaders });
  if (projects.response.status !== 200 || !Array.isArray(projects.payload)) return null;

  for (const project of projects.payload) {
    if (typeof project?.id !== 'string' || !project.id) continue;

    const detail = await request(`/projects/${project.id}`, { headers: authHeaders });
    if (detail.response.status !== 200) continue;

    if (Array.isArray(detail.payload?.members)) {
      const member = detail.payload.members.find((item) => typeof item?.employeeId === 'string' && item.employeeId.length > 0);
      if (member) return { id: member.employeeId };
    }

    if (Array.isArray(detail.payload?.assignments)) {
      const assignment = detail.payload.assignments.find(
        (item) => typeof item?.employeeId === 'string' && item.employeeId.length > 0,
      );
      if (assignment) return { id: assignment.employeeId };
    }
  }

  return null;
}

async function ensureEmployee(authHeaders, t) {
  const employees = await request('/employees', { headers: authHeaders });
  assert.equal(employees.response.status, 200, 'employees endpoint should return 200');
  assert.ok(Array.isArray(employees.payload), 'employees payload should be an array');

  if (employees.payload.length > 0) {
    return employees.payload[0];
  }

  const assignments = await request('/assignments', { headers: authHeaders });
  if (assignments.response.status === 200 && Array.isArray(assignments.payload)) {
    const assignmentEmployee = assignments.payload.find(
      (item) => typeof item?.employeeId === 'string' && item.employeeId.length > 0,
    );
    if (assignmentEmployee) return { id: assignmentEmployee.employeeId };
  }

  const reusableEmployee = await findReusableEmployeeFromWorkspace(authHeaders);
  if (reusableEmployee) return reusableEmployee;

  const roles = await request('/roles', { headers: authHeaders });
  assert.equal(roles.response.status, 200, 'roles endpoint should return 200');
  assert.ok(Array.isArray(roles.payload), 'roles payload should be an array');

  let availableRoles = roles.payload;
  if (availableRoles.length === 0) {
    const defaultsBootstrap = await request('/roles/defaults', {
      method: 'POST',
      headers: authHeaders,
    });

    if (defaultsBootstrap.response.status === 200 || defaultsBootstrap.response.status === 201) {
      const rolesAfterBootstrap = await request('/roles', { headers: authHeaders });
      assert.equal(rolesAfterBootstrap.response.status, 200, 'roles endpoint should return 200 after defaults bootstrap');
      assert.ok(Array.isArray(rolesAfterBootstrap.payload), 'roles payload should be an array after defaults bootstrap');
      availableRoles = rolesAfterBootstrap.payload;
    }
  }

  if (availableRoles.length === 0) {
    if (t) {
      t.skip('No roles available in current workspace scope to create smoke employee (including roles/defaults bootstrap).');
      return null;
    }
    assert.ok(availableRoles.length > 0, 'roles payload should not be empty');
  }

  const seed = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const createdEmployee = await request('/employees', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      fullName: `Smoke Employee ${seed}`,
      email: `smoke-employee-${seed}@projo.local`,
      roleId: availableRoles[0].id,
    }),
  });

  assert.equal(createdEmployee.response.status, 201, 'employee create endpoint should return 201');
  return createdEmployee.payload;
}

smokeTest('API e2e smoke: auth + timeline + calendar', 'core', async (t) => {
  if (!(await ensureApiAvailable(t))) return;

  const health = await request('/health');
  assert.equal(health.response.status, 200, 'health endpoint should return 200');

  const authHeaders = await getAuthHeaders(t);
  if (!authHeaders) return;

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

smokeTest('API e2e smoke: project-space KPI utilization is normalized', 'core', async (t) => {
  const authHeaders = await getAuthHeaders(t);
  if (!authHeaders) return;

  const projectsResponse = await request('/auth/projects', { headers: authHeaders });
  assert.equal(projectsResponse.response.status, 200, 'auth projects endpoint should return 200');
  assert.ok(Array.isArray(projectsResponse.payload?.myProjects), 'myProjects should be an array');
  assert.ok(Array.isArray(projectsResponse.payload?.sharedProjects), 'sharedProjects should be an array');

  const allProjectSpaces = [...projectsResponse.payload.myProjects, ...projectsResponse.payload.sharedProjects];
  for (const projectSpace of allProjectSpaces) {
    assert.equal(Number.isFinite(projectSpace?.projectsCount), true, 'projectsCount should be finite');
    assert.equal(Number.isFinite(projectSpace?.totalAllocationPercent), true, 'totalAllocationPercent should be finite');
    assert.equal(Number.isFinite(projectSpace?.peakAllocationPercent), true, 'peakAllocationPercent should be finite');
    assert.ok(Array.isArray(projectSpace?.monthlyLoadStats), 'monthlyLoadStats should be an array');
    assert.ok(projectSpace.monthlyLoadStats.length === 12, 'monthlyLoadStats should contain 12 months');
    assert.ok(projectSpace.projectsCount >= 0, 'projectsCount should be >= 0');
    assert.ok(projectSpace.totalAllocationPercent >= 0, 'totalAllocationPercent should be >= 0');
    assert.ok(projectSpace.peakAllocationPercent >= 0, 'peakAllocationPercent should be >= 0');
    assert.ok(
      projectSpace.totalAllocationPercent <= 1000,
      'totalAllocationPercent should stay in non-explosive range (regression guard for >1000% anomalies)',
    );
    assert.ok(
      projectSpace.peakAllocationPercent <= 1000,
      'peakAllocationPercent should stay in non-explosive range (regression guard for >1000% anomalies)',
    );
    assert.ok(
      projectSpace.peakAllocationPercent >= projectSpace.totalAllocationPercent,
      'peakAllocationPercent should be >= totalAllocationPercent (avg)',
    );

    if (projectSpace.projectsCount === 0) {
      assert.equal(projectSpace.totalAllocationPercent, 0, 'project spaces without projects should have 0% KPI load');
      assert.equal(projectSpace.peakAllocationPercent, 0, 'project spaces without projects should have 0% KPI peak load');
    }

    for (const monthEntry of projectSpace.monthlyLoadStats) {
      assert.ok(monthEntry.month >= 1 && monthEntry.month <= 12, 'monthlyLoadStats month should be in 1..12');
      assert.ok(Number.isFinite(monthEntry.avgAllocationPercent), 'monthly avg should be finite');
      assert.ok(Number.isFinite(monthEntry.peakAllocationPercent), 'monthly peak should be finite');
      assert.ok(monthEntry.avgAllocationPercent >= 0, 'monthly avg should be >= 0');
      assert.ok(monthEntry.peakAllocationPercent >= 0, 'monthly peak should be >= 0');
      assert.ok(monthEntry.peakAllocationPercent <= 1000, 'monthly peak should stay in non-explosive range');
    }
  }
});

smokeTest('API e2e smoke: project member + assignment consistency', 'core', async (t) => {
  const authHeaders = await getAuthHeaders(t, { json: true });
  if (!authHeaders) return;

  const employee = await ensureEmployee(authHeaders, t);
  if (!employee) return;
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

smokeTest('API e2e smoke: assignment update works after member removal (decoupled model)', 'extended', async (t) => {
  const authHeaders = await getAuthHeaders(t, { json: true });
  if (!authHeaders) return;

  const employee = await ensureEmployee(authHeaders, t);
  if (!employee) return;
  assert.equal(typeof employee?.id, 'string', 'employee id should be available');

  const projectCode = `E2E-MEMBER-RECOVERY-${Date.now()}`;
  const projectStart = `${year}-07-01T00:00:00.000Z`;
  const projectEnd = `${year}-07-31T00:00:00.000Z`;
  const assignmentStartDate = `${year}-07-03T00:00:00.000Z`;
  const assignmentEndDate = `${year}-07-24T00:00:00.000Z`;

  let createdProjectId = null;
  let createdAssignmentId = null;

  try {
    const createdProject = await request('/projects', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        code: projectCode,
        name: `Member Recovery ${projectCode}`,
        startDate: projectStart,
        endDate: projectEnd,
        status: 'planned',
        priority: 2,
        links: [],
      }),
    });
    assert.equal(createdProject.response.status, 201, 'project create endpoint should return 201');
    createdProjectId = createdProject.payload?.id;
    assert.equal(typeof createdProjectId, 'string', 'project id should be returned');

    const addMember = await request(`/projects/${createdProjectId}/members`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ employeeId: employee.id }),
    });
    assert.equal(addMember.response.status, 201, 'add member endpoint should return 201');

    const createAssignment = await request('/assignments', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        projectId: createdProjectId,
        employeeId: employee.id,
        assignmentStartDate,
        assignmentEndDate,
        allocationPercent: 40,
      }),
    });
    assert.equal(createAssignment.response.status, 201, 'assignment create endpoint should return 201');
    createdAssignmentId = createAssignment.payload?.id;
    assert.equal(typeof createdAssignmentId, 'string', 'assignment id should be returned');

    const removeMember = await request(`/projects/${createdProjectId}/members/${employee.id}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    assert.equal(removeMember.response.status, 200, 'remove member endpoint should return 200');

    const membersAfterRemoval = await request(`/projects/${createdProjectId}/members`, { headers: authHeaders });
    assert.equal(membersAfterRemoval.response.status, 200, 'project members endpoint should return 200 after removal');
    assert.ok(Array.isArray(membersAfterRemoval.payload), 'project members payload should be array after removal');
    assert.equal(
      membersAfterRemoval.payload.some((member) => member.employeeId === employee.id),
      false,
      'employee should be absent from members after explicit member removal',
    );

    const updateAssignment = await request(`/assignments/${createdAssignmentId}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ allocationPercent: 55 }),
    });
    assert.equal(updateAssignment.response.status, 200, 'assignment update should return 200');

    const projectMembersAfterAssignmentUpdate = await request(`/projects/${createdProjectId}/members`, { headers: authHeaders });
    assert.equal(projectMembersAfterAssignmentUpdate.response.status, 200, 'project members endpoint should return 200 after assignment update');
    assert.ok(Array.isArray(projectMembersAfterAssignmentUpdate.payload), 'project members payload should be array after assignment update');
    assert.equal(
      projectMembersAfterAssignmentUpdate.payload.some((member) => member.employeeId === employee.id),
      false,
      'assignment update should not implicitly restore membership in decoupled model',
    );

    const projectDetail = await request(`/projects/${createdProjectId}`, { headers: authHeaders });
    assert.equal(projectDetail.response.status, 200, 'project details endpoint should return 200');
    const updatedAssignment = (projectDetail.payload?.assignments ?? []).find((assignment) => assignment.id === createdAssignmentId);
    assert.ok(updatedAssignment, 'project detail should include updated assignment');
    assert.equal(Number(updatedAssignment.allocationPercent), 55, 'assignment allocation should be updated after membership recovery flow');
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

smokeTest('API e2e smoke: assignment outside project range is allowed and visible in timeline', 'extended', async (t) => {
  const authHeaders = await getAuthHeaders(t, { json: true });
  if (!authHeaders) return;

  const employee = await ensureEmployee(authHeaders, t);
  if (!employee) return;
  assert.equal(typeof employee?.id, 'string', 'employee id should be available');

  const projectCode = `E2E-FACT-RANGE-${Date.now()}`;
  const projectStart = `${year}-08-10T00:00:00.000Z`;
  const projectEnd = `${year}-08-20T00:00:00.000Z`;
  const assignmentStartDate = `${year}-08-01T00:00:00.000Z`;
  const assignmentEndDate = `${year}-08-31T00:00:00.000Z`;

  let createdProjectId = null;
  let createdAssignmentId = null;

  try {
    const createdProject = await request('/projects', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        code: projectCode,
        name: `Fact Range ${projectCode}`,
        startDate: projectStart,
        endDate: projectEnd,
        status: 'planned',
        priority: 2,
        links: [],
      }),
    });
    assert.equal(createdProject.response.status, 201, 'project create endpoint should return 201');
    createdProjectId = createdProject.payload?.id;
    assert.equal(typeof createdProjectId, 'string', 'created project should return id');

    const createdAssignment = await request('/assignments', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        projectId: createdProjectId,
        employeeId: employee.id,
        assignmentStartDate,
        assignmentEndDate,
        allocationPercent: 35,
      }),
    });
    assert.equal(createdAssignment.response.status, 201, 'assignment outside project range should be allowed');
    createdAssignmentId = createdAssignment.payload?.id;
    assert.equal(typeof createdAssignmentId, 'string', 'assignment id should be returned');

    const projectDetail = await request(`/projects/${createdProjectId}`, { headers: authHeaders });
    assert.equal(projectDetail.response.status, 200, 'project detail endpoint should return 200');
    const persistedAssignment = (projectDetail.payload?.assignments ?? []).find((assignment) => assignment.id === createdAssignmentId);
    assert.ok(persistedAssignment, 'project details should include created assignment');
    assert.equal(
      new Date(persistedAssignment.assignmentStartDate).toISOString(),
      new Date(assignmentStartDate).toISOString(),
      'assignment start outside project range should persist',
    );
    assert.equal(
      new Date(persistedAssignment.assignmentEndDate).toISOString(),
      new Date(assignmentEndDate).toISOString(),
      'assignment end outside project range should persist',
    );

    const timeline = await request(`/timeline/year?year=${year}`, { headers: authHeaders });
    assert.equal(timeline.response.status, 200, 'timeline endpoint should return 200');
    const timelineRow = timeline.payload.find((row) => row.id === createdProjectId);
    assert.ok(timelineRow, 'timeline should include created project row');
    assert.ok(Number(timelineRow.assignmentsCount) >= 1, 'timeline project row should include created assignment');
    assert.ok(Number(timelineRow.totalAllocationPercent) > 0, 'timeline should reflect non-zero allocation from out-of-range assignment');
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

smokeTest('API e2e smoke: project copy preserves members and assignments', 'extended', async (t) => {
  const authHeaders = await getAuthHeaders(t, { json: true });
  if (!authHeaders) return;

  const employee = await ensureEmployee(authHeaders, t);
  if (!employee) return;
  const originalCode = `E2E-COPY-${Date.now()}`;
  const projectStart = `${year}-03-01T00:00:00.000Z`;
  const projectEnd = `${year}-03-31T00:00:00.000Z`;
  const assignmentStart = `${year}-03-05T00:00:00.000Z`;
  const assignmentEnd = `${year}-03-20T00:00:00.000Z`;

  let originalProjectId = null;
  let originalAssignmentId = null;
  let copiedProjectId = null;
  let copiedAssignmentIds = [];

  try {
    const createdProject = await request('/projects', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        code: originalCode,
        name: `Copy Source ${originalCode}`,
        startDate: projectStart,
        endDate: projectEnd,
        status: 'planned',
        priority: 2,
        links: [],
      }),
    });

    assert.equal(createdProject.response.status, 201, 'source project create should return 201');
    originalProjectId = createdProject.payload.id;

    const addMember = await request(`/projects/${originalProjectId}/members`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ employeeId: employee.id }),
    });
    assert.equal(addMember.response.status, 201, 'source add member should return 201');

    const createdAssignment = await request('/assignments', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        projectId: originalProjectId,
        employeeId: employee.id,
        assignmentStartDate: assignmentStart,
        assignmentEndDate: assignmentEnd,
        allocationPercent: 45,
      }),
    });
    assert.equal(createdAssignment.response.status, 201, 'source assignment create should return 201');
    originalAssignmentId = createdAssignment.payload.id;

    const copiedProject = await request(`/projects/${originalProjectId}/copy`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({}),
    });
    assert.equal(copiedProject.response.status, 201, 'project copy endpoint should return 201');
    copiedProjectId = copiedProject.payload?.id;
    assert.equal(typeof copiedProjectId, 'string', 'copied project should return id');
    assert.notEqual(copiedProject.payload?.code, originalCode, 'copied project code should differ from source');

    const copiedProjectDetail = await request(`/projects/${copiedProjectId}`, { headers: authHeaders });
    assert.equal(copiedProjectDetail.response.status, 200, 'copied project detail should return 200');
    assert.ok(Array.isArray(copiedProjectDetail.payload?.members), 'copied project members should be an array');
    assert.ok(Array.isArray(copiedProjectDetail.payload?.assignments), 'copied project assignments should be an array');

    assert.ok(
      copiedProjectDetail.payload.members.some((member) => member.employeeId === employee.id),
      'copied project should preserve selected member',
    );

    const copiedAssignment = copiedProjectDetail.payload.assignments.find((assignment) => assignment.employeeId === employee.id);
    assert.ok(copiedAssignment, 'copied project should preserve assignment for selected employee');
    assert.equal(Number(copiedAssignment.allocationPercent), 45, 'copied assignment allocation should match source');
    assert.equal(
      new Date(copiedAssignment.assignmentStartDate).toISOString(),
      new Date(assignmentStart).toISOString(),
      'copied assignment start should match source',
    );
    assert.equal(
      new Date(copiedAssignment.assignmentEndDate).toISOString(),
      new Date(assignmentEnd).toISOString(),
      'copied assignment end should match source',
    );

    copiedAssignmentIds = copiedProjectDetail.payload.assignments.map((assignment) => assignment.id);
  } finally {
    for (const assignmentId of copiedAssignmentIds) {
      await request(`/assignments/${assignmentId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
    }

    if (originalAssignmentId) {
      await request(`/assignments/${originalAssignmentId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
    }

    if (copiedProjectId) {
      await request(`/projects/${copiedProjectId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
    }

    if (originalProjectId) {
      await request(`/projects/${originalProjectId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
    }
  }
});

smokeTest('API e2e smoke: project shift/resize keeps assignment flow consistent', 'core', async (t) => {
  const authHeaders = await getAuthHeaders(t, { json: true });
  if (!authHeaders) return;

  const employee = await ensureEmployee(authHeaders, t);
  if (!employee) return;
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

smokeTest('API e2e smoke: assignment curve persists and updates timeline aggregates', 'core', async (t) => {
  const authHeaders = await getAuthHeaders(t, { json: true });
  if (!authHeaders) return;

  const employee = await ensureEmployee(authHeaders, t);
  if (!employee) return;
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

smokeTest('API e2e smoke: assignment load profile flat-curve-flat transition recalculates timeline', 'extended', async (t) => {
  const authHeaders = await getAuthHeaders(t, { json: true });
  if (!authHeaders) return;

  const employee = await ensureEmployee(authHeaders, t);
  if (!employee) return;
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

smokeTest('API e2e smoke: auth project member role update and removal', 'core', async (t) => {
  if (authMode === 'sso' || accessTokenOverride) {
    t.skip('This scenario relies on local auth (register + invite).');
    return;
  }

  const ownerHeaders = await getAuthHeaders(t, { json: true });
  if (!ownerHeaders) return;

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

  try {
    const invite = await request(`/auth/projects/${projectId}/invite`, {
      method: 'POST',
      headers: ownerProjectHeaders,
      body: JSON.stringify({ email: invitedEmail, permission: 'editor' }),
    });
    assert.equal(invite.response.status, 201, 'invite should return 201');
    assert.ok(
      Array.isArray(invite.payload?.members) &&
        invite.payload.members.some((item) => item.email === invitedEmail.toLowerCase() && item.role === 'EDITOR'),
      'invite response should include invited member with EDITOR role',
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
  } finally {
    await request(`/auth/projects/${projectId}`, {
      method: 'DELETE',
      headers: ownerProjectHeaders,
    });
  }
});

smokeTest('API e2e smoke: company list/create/rename/switch lifecycle', 'core', async (t) => {
  const authHeaders = await getAuthHeaders(t, { json: true });
  if (!authHeaders) return;

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

  let effectiveHeaders = switchedHeaders;
  let projectsInCompany = await request('/auth/projects', { headers: effectiveHeaders });
  assert.equal(projectsInCompany.response.status, 200, 'projects endpoint should return 200 after company switch');
  let allProjects = [...(projectsInCompany.payload?.myProjects ?? []), ...(projectsInCompany.payload?.sharedProjects ?? [])];

  if (allProjects.length === 0) {
    const createProjectSpace = await request('/auth/projects', {
      method: 'POST',
      headers: effectiveHeaders,
      body: JSON.stringify({ name: `E2E Plan ${Date.now()}` }),
    });
    assert.equal(createProjectSpace.response.status, 201, 'project-space create should return 201 in an empty company');
    assert.equal(typeof createProjectSpace.payload?.accessToken, 'string', 'project-space create should return updated access token');

    effectiveHeaders = {
      Authorization: `Bearer ${createProjectSpace.payload.accessToken}`,
      'Content-Type': 'application/json',
    };
    projectsInCompany = await request('/auth/projects', { headers: effectiveHeaders });
    assert.equal(projectsInCompany.response.status, 200, 'projects endpoint should return 200 after project-space bootstrap');
    allProjects = [...(projectsInCompany.payload?.myProjects ?? []), ...(projectsInCompany.payload?.sharedProjects ?? [])];
  }

  assert.equal(typeof projectsInCompany.payload?.activeProjectId, 'string', 'active project id should be present');
  assert.ok(allProjects.length >= 1, 'projects list should contain at least one project in active company');
  assert.ok(
    allProjects.some((item) => item.id === projectsInCompany.payload.activeProjectId),
    'active project should belong to active company project list',
  );

  // Delete the last remaining plan in the created company and ensure the company still stays in the list (company can have 0 plans).
  const activeProjectId = projectsInCompany.payload.activeProjectId;
  const deleteProject = await request(`/auth/projects/${activeProjectId}`, {
    method: 'DELETE',
    headers: effectiveHeaders,
  });
  assert.equal(deleteProject.response.status, 200, 'project-space delete should return 200');
  assert.equal(typeof deleteProject.payload?.accessToken, 'string', 'delete project-space should return updated accessToken');

  const afterDeleteHeaders = {
    Authorization: `Bearer ${deleteProject.payload.accessToken}`,
    'Content-Type': 'application/json',
  };
  const afterDeleteCompanies = await request('/auth/companies', { headers: afterDeleteHeaders });
  assert.equal(afterDeleteCompanies.response.status, 200, 'companies endpoint should return 200 after last plan delete');
  assert.ok(
    Array.isArray(afterDeleteCompanies.payload?.companies) && afterDeleteCompanies.payload.companies.some((item) => item.id === createdCompany.id),
    'company should stay in companies list even if it has 0 plans',
  );
});

smokeTest('API e2e smoke: project-space token rotation keeps auth context consistent', 'core', async (t) => {
  const authHeaders = await getAuthHeaders(t, { json: true });
  if (!authHeaders) return;

  const projectNameA = `E2E Context A ${Date.now()}`;
  const projectNameB = `E2E Context B ${Date.now()}`;

  let projectIdA = null;
  let projectIdB = null;
  let effectiveHeaders = authHeaders;

  try {
    const createProjectA = await request('/auth/projects', {
      method: 'POST',
      headers: effectiveHeaders,
      body: JSON.stringify({ name: projectNameA }),
    });
    assert.equal(createProjectA.response.status, 201, 'create first project-space should return 201');
    assert.equal(typeof createProjectA.payload?.accessToken, 'string', 'create first project-space should return accessToken');
    projectIdA = createProjectA.payload?.user?.workspaceId ?? null;
    assert.equal(typeof projectIdA, 'string', 'first created project-space id should be present in user context');

    effectiveHeaders = {
      Authorization: `Bearer ${createProjectA.payload.accessToken}`,
      'Content-Type': 'application/json',
    };

    const createProjectB = await request('/auth/projects', {
      method: 'POST',
      headers: effectiveHeaders,
      body: JSON.stringify({ name: projectNameB }),
    });
    assert.equal(createProjectB.response.status, 201, 'create second project-space should return 201');
    assert.equal(typeof createProjectB.payload?.accessToken, 'string', 'create second project-space should return accessToken');
    projectIdB = createProjectB.payload?.user?.workspaceId ?? null;
    assert.equal(typeof projectIdB, 'string', 'second created project-space id should be present in user context');
    assert.notEqual(projectIdA, projectIdB, 'created project-space ids should differ');

    effectiveHeaders = {
      Authorization: `Bearer ${createProjectB.payload.accessToken}`,
      'Content-Type': 'application/json',
    };

    const projectsAfterCreate = await request('/auth/projects', { headers: effectiveHeaders });
    assert.equal(projectsAfterCreate.response.status, 200, 'projects endpoint should return 200 after creating project-spaces');
    const allProjectsAfterCreate = [...(projectsAfterCreate.payload?.myProjects ?? []), ...(projectsAfterCreate.payload?.sharedProjects ?? [])];
    assert.ok(allProjectsAfterCreate.some((item) => item.id === projectIdA), 'projects list should include first created project-space');
    assert.ok(allProjectsAfterCreate.some((item) => item.id === projectIdB), 'projects list should include second created project-space');

    const switchToA = await request('/auth/projects/switch', {
      method: 'POST',
      headers: effectiveHeaders,
      body: JSON.stringify({ projectId: projectIdA }),
    });
    assert.equal(switchToA.response.status, 201, 'switch project-space should return 201');
    assert.equal(typeof switchToA.payload?.accessToken, 'string', 'switch project-space should return accessToken');
    assert.equal(switchToA.payload?.user?.workspaceId, projectIdA, 'switched token should carry selected workspace context');

    effectiveHeaders = {
      Authorization: `Bearer ${switchToA.payload.accessToken}`,
      'Content-Type': 'application/json',
    };

    const meAfterSwitch = await request('/auth/me', { headers: effectiveHeaders });
    assert.equal(meAfterSwitch.response.status, 200, 'auth/me should return 200 after project switch');
    assert.equal(meAfterSwitch.payload?.workspaceId, projectIdA, 'auth/me workspace context should match switched project-space');

    const deleteProjectA = await request(`/auth/projects/${projectIdA}`, {
      method: 'DELETE',
      headers: effectiveHeaders,
    });
    assert.equal(deleteProjectA.response.status, 200, 'delete first created project-space should return 200');
    assert.equal(typeof deleteProjectA.payload?.accessToken, 'string', 'delete first project-space should return updated accessToken');

    effectiveHeaders = {
      Authorization: `Bearer ${deleteProjectA.payload.accessToken}`,
      'Content-Type': 'application/json',
    };

    const projectsAfterDeleteA = await request('/auth/projects', { headers: effectiveHeaders });
    assert.equal(projectsAfterDeleteA.response.status, 200, 'projects endpoint should return 200 after deleting first project-space');
    const allProjectsAfterDeleteA = [...(projectsAfterDeleteA.payload?.myProjects ?? []), ...(projectsAfterDeleteA.payload?.sharedProjects ?? [])];
    assert.equal(
      allProjectsAfterDeleteA.some((item) => item.id === projectIdA),
      false,
      'deleted first project-space should not remain in projects list',
    );
    assert.equal(
      allProjectsAfterDeleteA.some((item) => item.id === projectIdB),
      true,
      'second project-space should remain after deleting first one',
    );

    const deleteProjectB = await request(`/auth/projects/${projectIdB}`, {
      method: 'DELETE',
      headers: effectiveHeaders,
    });
    assert.equal(deleteProjectB.response.status, 200, 'delete second created project-space should return 200');
    assert.equal(typeof deleteProjectB.payload?.accessToken, 'string', 'delete second project-space should return updated accessToken');

    projectIdA = null;
    projectIdB = null;
  } finally {
    if (projectIdA) {
      await request(`/auth/projects/${projectIdA}`, {
        method: 'DELETE',
        headers: effectiveHeaders,
      });
    }

    if (projectIdB) {
      await request(`/auth/projects/${projectIdB}`, {
        method: 'DELETE',
        headers: effectiveHeaders,
      });
    }
  }
});

smokeTest('API e2e smoke: company counters are correct for owner and non-owner', 'extended', async (t) => {
  if (!(await ensureApiAvailable(t))) return;

  if (authMode === 'sso' || accessTokenOverride) {
    t.skip('This scenario relies on local auth (register + invite + companies counters).');
    return;
  }

  const ownerHeaders = await getAuthHeaders(t, { json: true });
  if (!ownerHeaders) return;

  const seed = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const invitedEmail = `e2e-company-member-${seed}@projo.local`;
  const invitedPassword = `E2eCompany!${seed}`;

  const invitedRegister = await request('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: invitedEmail,
      fullName: `E2E Company Member ${seed}`,
      password: invitedPassword,
    }),
  });
  assert.equal(invitedRegister.response.status, 201, 'invited user register should return 201');

  const createCompany = await request('/auth/companies', {
    method: 'POST',
    headers: ownerHeaders,
    body: JSON.stringify({ name: `E2E Counter Company ${seed}` }),
  });
  assert.equal(createCompany.response.status, 201, 'create company should return 201');
  assert.equal(typeof createCompany.payload?.accessToken, 'string', 'create company should return new access token');

  let ownerCompanyHeaders = {
    Authorization: `Bearer ${createCompany.payload.accessToken}`,
    'Content-Type': 'application/json',
  };

  const ownerCompaniesBeforeProject = await request('/auth/companies', { headers: ownerCompanyHeaders });
  assert.equal(ownerCompaniesBeforeProject.response.status, 200, 'owner companies endpoint should return 200');
  const createdCompany = ownerCompaniesBeforeProject.payload?.companies?.find((item) => item.name === `E2E Counter Company ${seed}`);
  assert.ok(createdCompany, 'created company should be present in owner companies list');
  assert.equal(createdCompany.isOwner, true, 'owner should see isOwner=true for created company');

  const createProject = await request('/auth/projects', {
    method: 'POST',
    headers: ownerCompanyHeaders,
    body: JSON.stringify({ name: `E2E Counter Plan ${seed}` }),
  });
  assert.equal(createProject.response.status, 201, 'create project-space should return 201');
  assert.equal(typeof createProject.payload?.accessToken, 'string', 'create project-space should return updated access token');
  const createdProjectId = createProject.payload?.user?.workspaceId;
  assert.equal(typeof createdProjectId, 'string', 'created project-space id should be present');

  ownerCompanyHeaders = {
    Authorization: `Bearer ${createProject.payload.accessToken}`,
    'Content-Type': 'application/json',
  };

  const ownerCompaniesAfterProject = await request('/auth/companies', { headers: ownerCompanyHeaders });
  assert.equal(ownerCompaniesAfterProject.response.status, 200, 'owner companies should return 200 after project create');
  const ownerCompanyAfterProject = ownerCompaniesAfterProject.payload?.companies?.find((item) => item.id === createdCompany.id);
  assert.ok(ownerCompanyAfterProject, 'created company should remain in owner list after project create');
  assert.ok(Number(ownerCompanyAfterProject.projectsCount) >= 1, 'owner should see at least one plan in company counter');

  const inviteMember = await request(`/auth/projects/${createdProjectId}/invite`, {
    method: 'POST',
    headers: ownerCompanyHeaders,
    body: JSON.stringify({ email: invitedEmail, permission: 'viewer' }),
  });
  assert.equal(inviteMember.response.status, 201, 'invite member should return 201');

  const invitedLogin = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: invitedEmail, password: invitedPassword }),
  });
  assert.equal(invitedLogin.response.status, 201, 'invited user login should return 201');
  assert.equal(typeof invitedLogin.payload?.accessToken, 'string', 'invited user login should return access token');

  const invitedHeaders = {
    Authorization: `Bearer ${invitedLogin.payload.accessToken}`,
    'Content-Type': 'application/json',
  };

  const invitedCompanies = await request('/auth/companies', { headers: invitedHeaders });
  assert.equal(invitedCompanies.response.status, 200, 'invited user companies endpoint should return 200');
  const invitedCompany = invitedCompanies.payload?.companies?.find((item) => item.id === createdCompany.id);
  assert.ok(invitedCompany, 'invited user should see shared company in companies list');
  assert.equal(invitedCompany.isOwner, false, 'invited user should see isOwner=false for shared company');
  assert.ok(Number(invitedCompany.projectsCount) >= 1, 'invited user should see non-zero plan counter for shared company');

  await request(`/auth/projects/${createdProjectId}`, {
    method: 'DELETE',
    headers: ownerCompanyHeaders,
  });
});

smokeTest('API e2e smoke: account register + me + password change', 'extended', async (t) => {
  if (!(await ensureApiAvailable(t))) return;

  if (authMode === 'sso' || accessTokenOverride) {
    t.skip('This scenario relies on local auth (register/login/password change).');
    return;
  }

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

  if (register.response.status === 410) {
    t.skip('Local auth is disabled (410).');
    return;
  }

  if (register.response.status === 404) {
    t.skip(`Register endpoint is not available at ${baseUrl}/auth/register (404).`);
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
