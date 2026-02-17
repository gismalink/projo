import { Controller, Get, ParseIntPipe, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AppRoleValue, Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { TimelineService } from './timeline.service';

type AuthenticatedRequest = {
  user: {
    workspaceId: string;
  };
};

@Controller('timeline')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TimelineController {
  constructor(private readonly timelineService: TimelineService) {}

  @Get('year')
  @Roles(AppRoleValue.ADMIN, AppRoleValue.PM, AppRoleValue.VIEWER, AppRoleValue.FINANCE)
  getYear(@Req() req: AuthenticatedRequest, @Query('year', new ParseIntPipe()) year: number) {
    return this.timelineService.getYearTimeline(req.user.workspaceId, year);
  }
}
