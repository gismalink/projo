import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class TimelineService {
  constructor(private readonly prisma: PrismaService) {}

  private clampPercent(value: number) {
    return Math.max(0, Math.min(100, value));
  }

  private startOfUtcDay(value: Date): Date {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }

  private createAssignmentLoadPercentResolver(assignment: {
    allocationPercent: unknown;
    loadProfile?: unknown;
  }) {
    const fallback = this.clampPercent(Number(assignment.allocationPercent));
    const profile = assignment.loadProfile;
    if (!profile || typeof profile !== 'object') {
      return () => fallback;
    }

    const candidate = profile as { mode?: unknown; points?: unknown };
    if (candidate.mode !== 'curve' || !Array.isArray(candidate.points) || candidate.points.length < 2) {
      return () => fallback;
    }

    const points = candidate.points
      .map((point) => {
        if (!point || typeof point !== 'object') return null;
        const typedPoint = point as { date?: unknown; value?: unknown };
        if (typeof typedPoint.date !== 'string') return null;
        const date = new Date(typedPoint.date);
        const value = Number(typedPoint.value);
        if (Number.isNaN(date.getTime()) || !Number.isFinite(value)) return null;
        const day = this.startOfUtcDay(date);
        return {
          dateMs: day.getTime(),
          value: this.clampPercent(value),
        };
      })
      .filter((point): point is { dateMs: number; value: number } => Boolean(point))
      .sort((left, right) => left.dateMs - right.dateMs);

    if (points.length < 2) {
      return () => fallback;
    }

    return (date: Date) => {
      const dateMs = this.startOfUtcDay(date).getTime();
      if (dateMs <= points[0].dateMs) return points[0].value;
      if (dateMs >= points[points.length - 1].dateMs) return points[points.length - 1].value;

      for (let index = 0; index < points.length - 1; index += 1) {
        const start = points[index];
        const end = points[index + 1];
        if (dateMs < start.dateMs || dateMs > end.dateMs) continue;
        const span = end.dateMs - start.dateMs;
        if (span <= 0) return start.value;
        const ratio = (dateMs - start.dateMs) / span;
        return start.value + (end.value - start.value) * ratio;
      }

      return fallback;
    };
  }

  private getAverageAssignmentLoadPercent(assignment: {
    assignmentStartDate: Date;
    assignmentEndDate: Date;
    allocationPercent: unknown;
    loadProfile?: unknown;
  }) {
    const start = this.startOfUtcDay(assignment.assignmentStartDate);
    const end = this.startOfUtcDay(assignment.assignmentEndDate);
    if (end < start) return 0;

    const resolveLoadPercent = this.createAssignmentLoadPercentResolver(assignment);
    let sum = 0;
    let days = 0;
    const cursor = new Date(start);
    while (cursor <= end) {
      sum += resolveLoadPercent(cursor);
      days += 1;
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return days > 0 ? sum / days : 0;
  }

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
            loadProfile: true,
            assignmentStartDate: true,
            assignmentEndDate: true,
            plannedHoursPerDay: true,
          },
        },
      },
      orderBy: { startDate: 'asc' },
    });

    return projects.map((project) => {
      const totalAllocationPercent = project.assignments.reduce((sum, assignment) => {
        return sum + this.getAverageAssignmentLoadPercent(assignment);
      }, 0);

      const totalPlannedHoursPerDay = project.assignments.reduce((sum, assignment) => {
        if (assignment.plannedHoursPerDay !== null) {
          return sum + Number(assignment.plannedHoursPerDay);
        }

        const averageLoadPercent = this.getAverageAssignmentLoadPercent(assignment);

        return (
          sum +
          (Number(assignment.employee.defaultCapacityHoursPerDay) * averageLoadPercent) / 100
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
