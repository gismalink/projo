const baseUrl = process.env.E2E_API_URL ?? 'http://localhost:4000/api';
const email = process.env.E2E_USER_EMAIL ?? 'admin@projo.local';
const password = process.env.E2E_USER_PASSWORD ?? 'ProjoAdmin!2026';
const year = Number(process.env.E2E_YEAR ?? new Date().getUTCFullYear());

async function req(path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, options);
  const text = await res.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  return { status: res.status, payload };
}

(async () => {
  const login = await req('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (login.status !== 201) {
    console.error('login failed', login);
    process.exit(1);
  }

  const token = login.payload.accessToken;
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const employees = await req('/employees', { headers });
  let employee = employees.payload?.[0];
  if (!employee?.id) {
    const roles = await req('/roles', { headers });
    const roleId = roles.payload?.[0]?.id;
    if (!roleId) {
      console.error('no roles to create employee', roles);
      process.exit(1);
    }

    const seed = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const createdEmployee = await req('/employees', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        fullName: `Debug Employee ${seed}`,
        email: `debug-employee-${seed}@projo.local`,
        roleId,
      }),
    });

    if (createdEmployee.status !== 201) {
      console.error('create employee failed', createdEmployee);
      process.exit(1);
    }

    employee = createdEmployee.payload;
  }

  const projectCode = `DBG-CURVE-${Date.now()}`;
  const projectStart = `${year}-05-01T00:00:00.000Z`;
  const projectEnd = `${year}-05-31T00:00:00.000Z`;
  const assignmentStart = `${year}-05-05T00:00:00.000Z`;
  const assignmentEnd = `${year}-05-20T00:00:00.000Z`;

  const createdProject = await req('/projects', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      code: projectCode,
      name: `Debug ${projectCode}`,
      startDate: projectStart,
      endDate: projectEnd,
      status: 'planned',
      priority: 2,
      links: [],
    }),
  });

  if (createdProject.status !== 201) {
    console.error('create project failed', createdProject);
    process.exit(1);
  }

  const projectId = createdProject.payload.id;
  const createdAssignment = await req('/assignments', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      projectId,
      employeeId: employee.id,
      assignmentStartDate: assignmentStart,
      assignmentEndDate: assignmentEnd,
      allocationPercent: 20,
    }),
  });

  if (createdAssignment.status !== 201) {
    console.error('create assignment failed', createdAssignment);
    process.exit(1);
  }

  const assignmentId = createdAssignment.payload.id;
  const updated = await req(`/assignments/${assignmentId}`, {
    method: 'PATCH',
    headers,
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

  console.log('PATCH /assignments status:', updated.status);
  console.log('PATCH /assignments payload:', updated.payload);

  await req(`/assignments/${assignmentId}`, { method: 'DELETE', headers });
  await req(`/projects/${projectId}`, { method: 'DELETE', headers });
})();
