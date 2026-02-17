import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class TimelineService {
  constructor(private readonly prisma: PrismaService) {}

  async getYearTimeline(workspaceId: string, year: number) {
    const yearStart = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
    const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59));

    const projects = await this.prisma.project.findMany({
      where: {
        workspaceId,
        startDate: { lte: yearEnd },
        endDate: { gte: yearStart },
      },
      include: {
        assignments: {
          select: {
            id: true,
            employee: {
              select: {
                id: true,
                fullName: true,
                defaultCapacityHoursPerDay: true,
              },
            },
            allocationPercent: true,
            assignmentStartDate: true,
            assignmentEndDate: true,
            plannedHoursPerDay: true,
          },
        },
      },
      orderBy: { startDate: 'asc' },
    });

    return projects.map((project) => {
      const totalAllocationPercent = project.assignments.reduce(
        (sum, assignment) => sum + Number(assignment.allocationPercent),
        0,
      );

      const totalPlannedHoursPerDay = project.assignments.reduce((sum, assignment) => {
        if (assignment.plannedHoursPerDay !== null) {
          return sum + Number(assignment.plannedHoursPerDay);
        }

        return (
          sum +
          (Number(assignment.employee.defaultCapacityHoursPerDay) * Number(assignment.allocationPercent)) / 100
        );
      }, 0);

      return {
        id: project.id,
        code: project.code,
        name: project.name,
        status: project.status,
        priority: project.priority,
        startDate: project.startDate,
        endDate: project.endDate,
        assignmentsCount: project.assignments.length,
        totalAllocationPercent,
        totalPlannedHoursPerDay: Number(totalPlannedHoursPerDay.toFixed(2)),
      };
    });
  }
}
