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
          level: 3,
          colorHex: DEFAULT_ROLE_COLOR_HEX,
        },
      });
      createdRoles += 1;
    }

    const [roles, departments, grades] = await Promise.all([
      this.prisma.role.findMany({
        where: companyId
          ? {
              OR: [{ companyId }, { companyId: null }],
            }
          : { companyId: null },
        select: { id: true, name: true },
      }),
      this.prisma.department.findMany({
        where: companyId
          ? {
              OR: [{ companyId }, { companyId: null }],
            }
          : { companyId: null },
        select: { id: true, name: true },
      }),
      this.prisma.grade.findMany({
        where: companyId
          ? {
              OR: [{ companyId }, { companyId: null }],
            }
          : { companyId: null },
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
        where: { workspaceId, fullName: spec.fullName },
        select: { id: true },
      });

      if (existing) {
        await this.prisma.employee.update({
          where: { id: existing.id },
          data: {
            roleId,
            departmentId: departmentId ?? null,
            grade,
            status: 'active',
          },
        });
        employeeByFullName.set(spec.fullName, { id: existing.id });
        updatedEmployees += 1;
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
        code: 'DEMO-1',
        name: 'Demo: Альфа',
        startDate: new Date(Date.UTC(year, 0, 1)),
        endDate: new Date(Date.UTC(year, 3, 30)),
      },
      {
        code: 'DEMO-2',
        name: 'Demo: Бета',
        startDate: new Date(Date.UTC(year, 4, 1)),
        endDate: new Date(Date.UTC(year, 7, 31)),
      },
      {
        code: 'DEMO-3',
        name: 'Demo: Гамма',
        startDate: new Date(Date.UTC(year, 8, 1)),
        endDate: new Date(Date.UTC(year, 11, 31)),
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
    const assignmentPlan: Array<{ projectCode: string; employeeFullName: string; allocationPercent: number }> = [
      { projectCode: 'DEMO-1', employeeFullName: 'Дизайнер Дизайнерски', allocationPercent: 60 },
      { projectCode: 'DEMO-1', employeeFullName: 'Моделлер Моделлерски', allocationPercent: 60 },
      { projectCode: 'DEMO-1', employeeFullName: 'Юнити Юнитевски', allocationPercent: 50 },
      { projectCode: 'DEMO-1', employeeFullName: 'Веб Вебовски', allocationPercent: 40 },

      { projectCode: 'DEMO-2', employeeFullName: 'Юнити Грантовски', allocationPercent: 60 },
      { projectCode: 'DEMO-2', employeeFullName: 'Бэк Бэковски', allocationPercent: 50 },
      { projectCode: 'DEMO-2', employeeFullName: 'Анали Аналитовски', allocationPercent: 40 },

      { projectCode: 'DEMO-3', employeeFullName: 'Текст Текстисовски', allocationPercent: 40 },
      { projectCode: 'DEMO-3', employeeFullName: 'Руководски', allocationPercent: 40 },
      { projectCode: 'DEMO-3', employeeFullName: 'Тестировски', allocationPercent: 50 },
    ];

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
