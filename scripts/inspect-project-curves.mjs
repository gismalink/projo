import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { code: 'PRJ-0051' },
        { name: { contains: 'Pilot CRM Rollout', mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      code: true,
      name: true,
      workspaceId: true,
      assignments: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          employeeId: true,
          assignmentStartDate: true,
          assignmentEndDate: true,
          allocationPercent: true,
          loadProfile: true,
          updatedAt: true,
        },
      },
    },
    orderBy: [{ code: 'asc' }, { createdAt: 'asc' }],
  });

  if (projects.length === 0) {
    console.log('No matching projects found.');
    return;
  }

  for (const project of projects) {
    console.log(`\nProject ${project.code} | ${project.name}`);
    console.log(`  id=${project.id}`);
    console.log(`  workspaceId=${project.workspaceId}`);
    if (project.assignments.length === 0) {
      console.log('  assignments: 0');
      continue;
    }

    console.log(`  assignments: ${project.assignments.length}`);
    for (const assignment of project.assignments) {
      const curveMode =
        assignment.loadProfile && typeof assignment.loadProfile === 'object' && assignment.loadProfile.mode
          ? assignment.loadProfile.mode
          : 'null';
      console.log(`    - assignmentId=${assignment.id}`);
      console.log(`      employeeId=${assignment.employeeId}`);
      console.log(`      range=${assignment.assignmentStartDate.toISOString()}..${assignment.assignmentEndDate.toISOString()}`);
      console.log(`      allocationPercent=${assignment.allocationPercent.toString()}`);
      console.log(`      loadProfileMode=${curveMode}`);
      console.log(`      loadProfile=${JSON.stringify(assignment.loadProfile)}`);
      console.log(`      updatedAt=${assignment.updatedAt.toISOString()}`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
