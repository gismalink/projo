import { BadGatewayException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ErrorCode } from '../common/error-codes';
import { PrismaService } from '../common/prisma.service';

type ExternalHolidayItem = { date: string; name: string };
type ExternalHolidaysResponse = {
  year: number;
  holidays: ExternalHolidayItem[];
  shortDays: ExternalHolidayItem[];
  status: number;
};

@Injectable()
export class CalendarService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CalendarService.name);
  private readonly apiBaseUrl = process.env.CALENDAR_API_URL ?? 'https://calendar.kuzyak.in';
  private readonly ttlMs = 24 * 60 * 60 * 1000;
  private readonly syncEnabled = process.env.CALENDAR_SYNC_ENABLED !== 'false';
  private readonly syncIntervalMs = Number(process.env.CALENDAR_SYNC_INTERVAL_MS ?? this.ttlMs);
  private syncTimer: NodeJS.Timeout | null = null;
  private isBackgroundSyncRunning = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (!this.syncEnabled) {
      this.logger.log('Background calendar sync is disabled');
      return;
    }

    void this.runBackgroundSync();
    this.syncTimer = setInterval(() => {
      void this.runBackgroundSync();
    }, this.syncIntervalMs);
  }

  onModuleDestroy() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  private async runBackgroundSync() {
    if (this.isBackgroundSyncRunning) return;
    this.isBackgroundSyncRunning = true;

    try {
      await this.syncYears([], false, true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Background calendar sync failed: ${message}`);
    } finally {
      this.isBackgroundSyncRunning = false;
    }
  }

  private toUtcDateOnly(value: Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }

  private isLeapYear(year: number) {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  }

  private getDaysInYear(year: number) {
    return this.isLeapYear(year) ? 366 : 365;
  }

  private async fetchYearHolidays(year: number): Promise<ExternalHolidaysResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(`${this.apiBaseUrl}/api/calendar/${year}/holidays`, {
        method: 'GET',
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new BadGatewayException(ErrorCode.CALENDAR_SYNC_FAILED);
      }
      return (await response.json()) as ExternalHolidaysResponse;
    } catch {
      throw new BadGatewayException(ErrorCode.CALENDAR_SYNC_FAILED);
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildYearDays(year: number, holidays: ExternalHolidayItem[]) {
    const holidayByDate = new Map(holidays.map((item) => [item.date, item.name]));
    const daysInYear = this.getDaysInYear(year);
    const sourceSyncedAt = new Date();

    return Array.from({ length: daysInYear }, (_, index) => {
      const date = new Date(Date.UTC(year, 0, 1));
      date.setUTCDate(date.getUTCDate() + index);
      const normalizedDate = this.toUtcDateOnly(date);
      const isoDate = normalizedDate.toISOString().slice(0, 10);
      const weekDay = normalizedDate.getUTCDay();
      const isWeekend = weekDay === 0 || weekDay === 6;
      const holidayName = holidayByDate.get(isoDate) ?? null;
      const isHoliday = Boolean(holidayName);

      return {
        date: normalizedDate,
        isWeekend,
        isHoliday,
        isWorkingDay: !isWeekend && !isHoliday,
        holidayName,
        sourceYear: year,
        sourceSyncedAt,
      };
    });
  }

  private async hasCompleteSnapshot(year: number) {
    const count = await this.prisma.calendarDay.count({ where: { sourceYear: year } });
    return count === this.getDaysInYear(year);
  }

  private async shouldSyncYear(year: number, force: boolean) {
    if (force) return true;

    const syncState = await this.prisma.calendarYearSync.findUnique({ where: { year } });
    if (!syncState?.lastSuccessAt) return true;

    const ageMs = Date.now() - syncState.lastSuccessAt.getTime();
    if (ageMs > this.ttlMs) return true;

    const completeSnapshot = await this.hasCompleteSnapshot(year);
    return !completeSnapshot;
  }

  private async writeSyncFailure(year: number, errorMessage: string) {
    await this.prisma.calendarYearSync.upsert({
      where: { year },
      create: {
        year,
        lastAttemptAt: new Date(),
        lastStatus: 'error',
        lastError: errorMessage,
      },
      update: {
        lastAttemptAt: new Date(),
        lastStatus: 'error',
        lastError: errorMessage,
      },
    });
  }

  async syncYear(year: number, force = false) {
    const needSync = await this.shouldSyncYear(year, force);
    if (!needSync) {
      const state = await this.prisma.calendarYearSync.findUnique({ where: { year } });
      return {
        year,
        refreshed: false,
        usedFallback: false,
        lastSuccessAt: state?.lastSuccessAt ?? null,
      };
    }

    try {
      const payload = await this.fetchYearHolidays(year);
      const days = this.buildYearDays(year, payload.holidays ?? []);

      await this.prisma.$transaction([
        this.prisma.calendarDay.deleteMany({ where: { sourceYear: year } }),
        this.prisma.calendarDay.createMany({ data: days }),
        this.prisma.calendarYearSync.upsert({
          where: { year },
          create: {
            year,
            lastAttemptAt: new Date(),
            lastSuccessAt: new Date(),
            lastStatus: 'ok',
            lastError: null,
          },
          update: {
            lastAttemptAt: new Date(),
            lastSuccessAt: new Date(),
            lastStatus: 'ok',
            lastError: null,
          },
        }),
      ]);

      const state = await this.prisma.calendarYearSync.findUnique({ where: { year } });
      return {
        year,
        refreshed: true,
        usedFallback: false,
        lastSuccessAt: state?.lastSuccessAt ?? null,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.writeSyncFailure(year, message);

      const completeSnapshot = await this.hasCompleteSnapshot(year);
      if (completeSnapshot) {
        const state = await this.prisma.calendarYearSync.findUnique({ where: { year } });
        return {
          year,
          refreshed: false,
          usedFallback: true,
          lastSuccessAt: state?.lastSuccessAt ?? null,
        };
      }

      throw new BadGatewayException(ErrorCode.CALENDAR_SYNC_FAILED);
    }
  }

  async syncYears(years: number[], force = false, includeNextYear = true) {
    const targetYears = new Set(years);
    if (targetYears.size === 0) {
      const currentYear = new Date().getUTCFullYear();
      targetYears.add(currentYear);
    }

    if (includeNextYear) {
      for (const year of Array.from(targetYears)) {
        targetYears.add(year + 1);
      }
    }

    const sortedYears = Array.from(targetYears).sort((a, b) => a - b);
    const results = [] as Array<{ year: number; refreshed: boolean; usedFallback: boolean; lastSuccessAt: Date | null }>;
    for (const year of sortedYears) {
      results.push(await this.syncYear(year, force));
    }

    return { years: sortedYears, results };
  }

  async getYear(year: number, forceRefresh = false) {
    await this.syncYear(year, forceRefresh);

    const days = await this.prisma.calendarDay.findMany({
      where: { sourceYear: year },
      orderBy: { date: 'asc' },
    });

    return {
      year,
      days: days.map((item) => ({
        date: item.date.toISOString().slice(0, 10),
        isWeekend: item.isWeekend,
        isHoliday: item.isHoliday,
        isWorkingDay: item.isWorkingDay,
        holidayName: item.holidayName,
      })),
    };
  }

  async getHealth() {
    const currentYear = new Date().getUTCFullYear();
    const nextYear = currentYear + 1;
    const [currentState, nextState] = await Promise.all([
      this.prisma.calendarYearSync.findUnique({ where: { year: currentYear } }),
      this.prisma.calendarYearSync.findUnique({ where: { year: nextYear } }),
    ]);

    const nowMs = Date.now();
    const freshness = (value: Date | null | undefined) => {
      if (!value) return 'missing';
      return nowMs - value.getTime() <= this.ttlMs ? 'fresh' : 'stale';
    };

    return {
      ttlHours: 24,
      currentYear: {
        year: currentYear,
        lastAttemptAt: currentState?.lastAttemptAt ?? null,
        lastSuccessAt: currentState?.lastSuccessAt ?? null,
        lastStatus: currentState?.lastStatus ?? 'missing',
        freshness: freshness(currentState?.lastSuccessAt),
      },
      nextYear: {
        year: nextYear,
        lastAttemptAt: nextState?.lastAttemptAt ?? null,
        lastSuccessAt: nextState?.lastSuccessAt ?? null,
        lastStatus: nextState?.lastStatus ?? 'missing',
        freshness: freshness(nextState?.lastSuccessAt),
      },
    };
  }
}
