import { Body, Controller, Get, Param, ParseBoolPipe, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AppRoleValue, Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CalendarService } from './calendar.service';
import { SyncCalendarDto } from './dto/sync-calendar.dto';

@Controller('calendar')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get('health/status')
  @Roles(AppRoleValue.ADMIN, AppRoleValue.PM, AppRoleValue.VIEWER, AppRoleValue.FINANCE)
  health() {
    return this.calendarService.getHealth();
  }

  @Post('sync')
  @Roles(AppRoleValue.ADMIN, AppRoleValue.PM)
  sync(@Body() dto: SyncCalendarDto) {
    return this.calendarService.syncYears(dto.years ?? [], dto.force ?? false, dto.includeNextYear ?? true);
  }

  @Get(':year')
  @Roles(AppRoleValue.ADMIN, AppRoleValue.PM, AppRoleValue.VIEWER, AppRoleValue.FINANCE)
  getYear(
    @Param('year', ParseIntPipe) year: number,
    @Query('refresh', new ParseBoolPipe({ optional: true })) refresh?: boolean,
  ) {
    return this.calendarService.getYear(year, refresh ?? false);
  }
}
