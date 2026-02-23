import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { DEFAULT_ROLE_COLOR_HEX } from '../common/app-constants';
import { ErrorCode } from '../common/error-codes';
import { DepartmentsService } from '../departments/departments.service';
import { GradesService } from '../grades/grades.service';
import { RolesService } from '../roles/roles.service';

type SeedResult = {
  ensuredDefaults: {
    rolesCreated: number;
    departmentsCreated: number;
    gradesCreated: number;
  };
  created: {
    roles: number;
    employees: number;
    projects: number;
    members: number;
    assignments: number;
  };
  updated: {
    employees: number;
    projects: number;
    members: number;
    assignments: number;
  };
};

type DemoEmployeeSpec = {
  fullName: string;
  roleName: string;
  departmentName: string;
};

@Injectable()
export class DemoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rolesService: RolesService,
    private readonly departmentsService: DepartmentsService,
    private readonly gradesService: GradesService,
  ) {}

  private async getWorkspaceCompanyId(workspaceId: string): Promise<string | null> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { companyId: true },
    });

    if (!workspace) {
      throw new NotFoundException(ErrorCode.PROJECT_NOT_FOUND);
    }

    return workspace.companyId;
  }

  private isoDate(value: Date) {
    return value.toISOString().slice(0, 10);
  }

  private buildCurveProfile(points: Array<{ date: Date; value: number }>) {
    return {
      mode: 'curve',
      points: points.map((point) => ({
        date: point.date.toISOString(),
        value: point.value,
      })),
    };
  }

  async seedDemoWorkspace(workspaceId: string): Promise<SeedResult> {
    const ensuredDefaults = {
      rolesCreated: (await this.rolesService.createDefaultRolesForWorkspace(workspaceId)).created,
      departmentsCreated: (await this.departmentsService.createDefaultDepartmentsForWorkspace(workspaceId)).created,
      gradesCreated: (await this.gradesService.createDefaultGradesForWorkspace(workspaceId)).created,
    };

    const companyId = await this.getWorkspaceCompanyId(workspaceId);

    // Ensure one extra role used by the demo set.
    const extraRoleName = 'COPYWRITER';
    const existingCopywriter = await this.prisma.role.findFirst({
      where: { companyId, name: extraRoleName },
      select: { id: true },
    });

    let createdRoles = 0;
    if (!existingCopywriter) {
      await this.prisma.role.create({
        data: {
          companyId,
          name: extraRoleName,
          shortName: 'TEXT',
          description: 'Text writer / copywriter',
          colorHex: DEFAULT_ROLE_COLOR_HEX,
        },
      });
      createdRoles += 1;
    }

    const [roles, departments, grades] = await Promise.all([
      this.prisma.role.findMany({
        where: companyId ? { companyId } : { companyId: null },
        select: { id: true, name: true },
      }),
      this.prisma.department.findMany({
        where: companyId ? { companyId } : { companyId: null },
        select: { id: true, name: true },
      }),
      this.prisma.grade.findMany({
        where: companyId ? { companyId } : { companyId: null },
        select: { name: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const roleIdByName = new Map(roles.map((role) => [role.name, role.id] as const));
    const departmentIdByName = new Map(departments.map((dept) => [dept.name, dept.id] as const));
    const gradeNames = grades.map((g) => g.name).filter(Boolean);

    const employeesToCreate: DemoEmployeeSpec[] = [
      { fullName: 'Дизайнер Дизайнерски', roleName: 'UI_DESIGNER', departmentName: 'Design' },
      { fullName: 'Моделлер Моделлерски', roleName: '3D_ARTIST', departmentName: 'Production' },
      { fullName: 'Юнити Юнитевски', roleName: 'UNITY_DEVELOPER', departmentName: 'Production' },
      { fullName: 'Юнити Грантовски', roleName: 'UNITY_DEVELOPER', departmentName: 'Production' },
      { fullName: 'Веб Вебовски', roleName: 'FRONTEND_DEVELOPER', departmentName: 'Production' },
      { fullName: 'Бэк Бэковски', roleName: 'BACKEND_DEVELOPER', departmentName: 'Production' },
      { fullName: 'Анали Аналитовски', roleName: 'ANALYST', departmentName: 'Analytics' },
      { fullName: 'Текст Текстисовски', roleName: 'COPYWRITER', departmentName: 'Design' },
      { fullName: 'Руководски', roleName: 'PM', departmentName: 'Management' },
      { fullName: 'Тестировски', roleName: 'QA_ENGINEER', departmentName: 'QA' },
    ];

    let createdEmployees = 0;
    let updatedEmployees = 0;

    const employeeByFullName = new Map<string, { id: string }>();

    for (let index = 0; index < employeesToCreate.length; index += 1) {
      const spec = employeesToCreate[index];
      const roleId = roleIdByName.get(spec.roleName) ?? roleIdByName.get('VIEWER');
      const departmentId = departmentIdByName.get(spec.departmentName);

      if (!roleId) {
        throw new NotFoundException('Missing roles: run /roles/defaults first');
      }

      const grade = gradeNames.length > 0 ? gradeNames[index % gradeNames.length] : null;

      const existing = await this.prisma.employee.findFirst({
        where: companyId
          ? {
              fullName: spec.fullName,
              workspace: {
                companyId,
              },
            }
          : { workspaceId, fullName: spec.fullName },
        select: { id: true, workspaceId: true },
      });

      if (existing) {
        // Only update attributes when the employee already belongs to this workspace,
        // to avoid accidentally modifying a real employee from another plan.
        if (existing.workspaceId === workspaceId) {
          await this.prisma.employee.update({
            where: { id: existing.id },
            data: {
              roleId,
              departmentId: departmentId ?? null,
              grade,
              status: 'active',
            },
          });
        }
        employeeByFullName.set(spec.fullName, { id: existing.id });
        updatedEmployees += existing.workspaceId === workspaceId ? 1 : 0;
        continue;
      }

      const created = await this.prisma.employee.create({
        data: {
          workspaceId,
          fullName: spec.fullName,
          email: null,
          grade,
          status: 'active',
          roleId,
          departmentId: departmentId ?? null,
        },
        select: { id: true },
      });

      employeeByFullName.set(spec.fullName, { id: created.id });
      createdEmployees += 1;
    }

    const now = new Date();
    const year = now.getUTCFullYear();
    const projectSpecs = [
      {
        code: 'DEMO-CORE',
        name: 'Demo: Core Delivery',
        startDate: new Date(Date.UTC(year, 0, 1)),
        endDate: new Date(Date.UTC(year, 11, 31)),
      },
      {
        code: 'DEMO-Q1',
        name: 'Demo: Q1 Release (peak)',
        startDate: new Date(Date.UTC(year, 1, 1)),
        endDate: new Date(Date.UTC(year, 2, 31)),
      },
      {
        code: 'DEMO-Q4',
        name: 'Demo: Q4 Release (peak)',
        startDate: new Date(Date.UTC(year, 9, 1)),
        endDate: new Date(Date.UTC(year, 9, 31)),
      },
      {
        code: 'DEMO-HOTFIX',
        name: 'Demo: Hotfix Sprint',
        startDate: new Date(Date.UTC(year, 10, 15)),
        endDate: new Date(Date.UTC(year, 11, 15)),
      },
    ];

    let createdProjects = 0;
    let updatedProjects = 0;

    const projects: Array<{ id: string; code: string; startDate: Date; endDate: Date }> = [];

    for (const spec of projectSpecs) {
      const existing = await this.prisma.project.findUnique({
        where: {
          workspaceId_code: {
            workspaceId,
            code: spec.code,
          },
        },
        select: { id: true },
      });

      if (existing) {
        const updated = await this.prisma.project.update({
          where: { id: existing.id },
          data: {
            name: spec.name,
            startDate: spec.startDate,
            endDate: spec.endDate,
            status: 'planned',
          },
          select: { id: true },
        });
        projects.push({ id: updated.id, code: spec.code, startDate: spec.startDate, endDate: spec.endDate });
        updatedProjects += 1;
        continue;
      }

      const created = await this.prisma.project.create({
        data: {
          workspaceId,
          code: spec.code,
          name: spec.name,
          description: null,
          status: 'planned',
          priority: 3,
          startDate: spec.startDate,
          endDate: spec.endDate,
        },
        select: { id: true },
      });
      projects.push({ id: created.id, code: spec.code, startDate: spec.startDate, endDate: spec.endDate });
      createdProjects += 1;
    }

    const byCode = new Map(projects.map((p) => [p.code, p] as const));

    const core = byCode.get('DEMO-CORE');
    const q1 = byCode.get('DEMO-Q1');
    const q4 = byCode.get('DEMO-Q4');
    const hotfix = byCode.get('DEMO-HOTFIX');

    const assignmentPlan: Array<{
      projectCode: string;
      employeeFullName: string;
      allocationPercent: number;
      loadProfile?: unknown;
    }> = [];

    const corePointDates = {
      y0: new Date(Date.UTC(year, 0, 1)),
      feb15: new Date(Date.UTC(year, 1, 15)),
      apr1: new Date(Date.UTC(year, 3, 1)),
      jun1: new Date(Date.UTC(year, 5, 1)),
      jul1: new Date(Date.UTC(year, 6, 1)),
      aug15: new Date(Date.UTC(year, 7, 15)),
      sep1: new Date(Date.UTC(year, 8, 1)),
      oct15: new Date(Date.UTC(year, 9, 15)),
      nov15: new Date(Date.UTC(year, 10, 15)),
      y1: new Date(Date.UTC(year, 11, 31)),
    };

    const perEmployeeJitter = (index: number) => {
      const normalized = Math.sin((index + 1) * 1337) * 0.5 + 0.5;
      return Math.round((normalized * 8 - 4) * 10) / 10;
    };

    // Baseline: everyone is assigned to the core project for the whole year, with a summer dip and release peaks.
    for (let index = 0; index < employeesToCreate.length; index += 1) {
      const spec = employeesToCreate[index];
      if (!core) continue;

      const jitter = perEmployeeJitter(index);
      const roleFactor = spec.roleName === 'PM' ? -6 : spec.roleName === 'ANALYST' ? -3 : spec.roleName === 'QA_ENGINEER' ? -1 : 0;

      const points = [
        { date: corePointDates.y0, value: 86 + jitter + roleFactor },
        { date: corePointDates.feb15, value: 92 + jitter + roleFactor },
        { date: corePointDates.apr1, value: 88 + jitter + roleFactor },
        { date: corePointDates.jun1, value: 82 + jitter + roleFactor },
        { date: corePointDates.jul1, value: 70 + jitter + roleFactor },
        { date: corePointDates.aug15, value: 72 + jitter + roleFactor },
        { date: corePointDates.sep1, value: 84 + jitter + roleFactor },
        { date: corePointDates.oct15, value: 90 + jitter + roleFactor },
        { date: corePointDates.nov15, value: 94 + jitter + roleFactor },
        { date: corePointDates.y1, value: 86 + jitter + roleFactor },
      ].map((point) => ({
        date: point.date,
        value: Math.max(45, Math.min(98, point.value)),
      }));

      assignmentPlan.push({
        projectCode: core.code,
        employeeFullName: spec.fullName,
        allocationPercent: 86,
        loadProfile: this.buildCurveProfile(points),
      });
    }

    // Q1 peak: add extra load for the delivery team (+ design + QA + PM).
    if (q1) {
      const q1Names = [
        'Юнити Юнитевски',
        'Юнити Грантовски',
        'Веб Вебовски',
        'Бэк Бэковски',
        'Дизайнер Дизайнерски',
        'Тестировски',
        'Руководски',
      ];
      for (const fullName of q1Names) {
        assignmentPlan.push({
          projectCode: q1.code,
          employeeFullName: fullName,
          allocationPercent: 35,
        });
      }
    }

    // Q4 peak: larger spike for most of the team.
    if (q4) {
      const q4Names = [
        'Юнити Юнитевски',
        'Юнити Грантовски',
        'Веб Вебовски',
        'Бэк Бэковски',
        'Дизайнер Дизайнерски',
        'Моделлер Моделлерски',
        'Тестировски',
        'Анали Аналитовски',
      ];
      for (const fullName of q4Names) {
        assignmentPlan.push({
          projectCode: q4.code,
          employeeFullName: fullName,
          allocationPercent: 40,
        });
      }
    }

    // Hotfix sprint: short overload for a small subset.
    if (hotfix) {
      const hotfixNames = ['Юнити Юнитевски', 'Веб Вебовски', 'Бэк Бэковски', 'Тестировски'];
      for (const fullName of hotfixNames) {
        assignmentPlan.push({
          projectCode: hotfix.code,
          employeeFullName: fullName,
          allocationPercent: 30,
        });
      }
    }

    let createdAssignments = 0;
    let updatedAssignments = 0;
    let createdMembers = 0;
    let updatedMembers = 0;

    for (const item of assignmentPlan) {
      const project = byCode.get(item.projectCode);
      const employee = employeeByFullName.get(item.employeeFullName);
      if (!project || !employee) continue;

      const memberExisting = await this.prisma.projectMember.findFirst({
        where: { projectId: project.id, employeeId: employee.id },
        select: { id: true },
      });

      if (memberExisting) {
        updatedMembers += 1;
      } else {
        await this.prisma.projectMember.create({
          data: {
            projectId: project.id,
            employeeId: employee.id,
          },
        });
        createdMembers += 1;
      }

      const assignmentExisting = await this.prisma.projectAssignment.findUnique({
        where: {
          projectId_employeeId: {
            projectId: project.id,
            employeeId: employee.id,
          },
        },
        select: { id: true },
      });

      if (assignmentExisting) {
        await this.prisma.projectAssignment.update({
          where: { id: assignmentExisting.id },
          data: {
            assignmentStartDate: project.startDate,
            assignmentEndDate: project.endDate,
            allocationPercent: item.allocationPercent,
            loadProfile: item.loadProfile ?? undefined,
            roleOnProject: null,
          },
        });
        updatedAssignments += 1;
      } else {
        await this.prisma.projectAssignment.create({
          data: {
            projectId: project.id,
            employeeId: employee.id,
            assignmentStartDate: project.startDate,
            assignmentEndDate: project.endDate,
            allocationPercent: item.allocationPercent,
            loadProfile: item.loadProfile ?? undefined,
            roleOnProject: null,
          },
        });
        createdAssignments += 1;
      }
    }

    return {
      ensuredDefaults,
      created: {
        roles: createdRoles,
        employees: createdEmployees,
        projects: createdProjects,
        members: createdMembers,
        assignments: createdAssignments,
      },
      updated: {
        employees: updatedEmployees,
        projects: updatedProjects,
        members: updatedMembers,
        assignments: updatedAssignments,
      },
    };
  }
}
