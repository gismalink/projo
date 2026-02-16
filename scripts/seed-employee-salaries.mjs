import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function normalize(value) {
  return (value ?? '').toString().trim().toLowerCase();
}

function resolveMonthlySalary(grade, roleName, roleLevel) {
  const normalizedGrade = normalize(grade);
  const normalizedRole = normalize(roleName);

  if (
    normalizedGrade.includes('рук') ||
    normalizedRole.includes('head') ||
    normalizedRole.includes('руковод') ||
    normalizedRole.includes('director')
  ) {
    return 9000;
  }
  if (
    normalizedGrade.includes('lead') ||
    normalizedGrade.includes('лид') ||
    normalizedGrade.includes('синьйор+')
  ) {
    return 7600;
  }
  if (
    normalizedGrade.includes('senior') ||
    normalizedGrade.includes('синь')
  ) {
    return 6400;
  }
  if (
    normalizedGrade.includes('middle') ||
    normalizedGrade.includes('мидл+')
  ) {
    return 5300;
  }
  if (normalizedGrade.includes('мидл')) {
    return 4800;
  }
  if (
    normalizedGrade.includes('jun') ||
    normalizedGrade.includes('джун+')
  ) {
    return 3600;
  }
  if (normalizedGrade.includes('джу')) {
    return 3200;
  }

  const roleLevelSafe = Number.isFinite(Number(roleLevel)) ? Number(roleLevel) : 3;
  return Math.max(3000, 3200 + roleLevelSafe * 420);
}

function toHourly(monthlySalary) {
  return Number((monthlySalary / 168).toFixed(2));
}

async function main() {
  const now = new Date();
  const validFrom = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));

  const [employees, employeeRates] = await Promise.all([
    prisma.employee.findMany({
      select: {
        id: true,
        fullName: true,
        grade: true,
        role: {
          select: {
            name: true,
            level: true,
          },
        },
      },
      orderBy: [{ fullName: 'asc' }],
    }),
    prisma.costRate.findMany({
      where: {
        employeeId: { not: null },
      },
      select: {
        employeeId: true,
        validFrom: true,
        validTo: true,
      },
    }),
  ]);

  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const hasActiveRateByEmployeeId = new Map();
  for (const row of employeeRates) {
    if (!row.employeeId) continue;
    const isActive = row.validFrom <= today && (!row.validTo || row.validTo >= today);
    if (isActive) {
      hasActiveRateByEmployeeId.set(row.employeeId, true);
    }
  }

  const inserts = [];
  for (const employee of employees) {
    if (hasActiveRateByEmployeeId.get(employee.id)) continue;

    const monthlySalary = resolveMonthlySalary(employee.grade, employee.role.name, employee.role.level);
    const amountPerHour = toHourly(monthlySalary);

    inserts.push({
      employeeId: employee.id,
      roleId: null,
      amountPerHour,
      currency: 'USD',
      validFrom,
      validTo: null,
    });
  }

  if (inserts.length > 0) {
    await prisma.costRate.createMany({ data: inserts });
  }

  const touchedEmployees = inserts.length;
  console.log(`Employees total: ${employees.length}`);
  console.log(`New salaries assigned: ${touchedEmployees}`);
  console.log(`Skipped (already have active personal rate): ${employees.length - touchedEmployees}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
