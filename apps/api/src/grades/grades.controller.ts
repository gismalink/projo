import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AppRoleValue, Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateGradeDto } from './dto/create-grade.dto';
import { UpdateGradeDto } from './dto/update-grade.dto';
import { GradesService } from './grades.service';

type AuthenticatedRequest = {
  user: {
    workspaceId: string;
  };
};

@Controller('grades')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GradesController {
  constructor(private readonly gradesService: GradesService) {}

  @Post()
  @Roles(AppRoleValue.ADMIN)
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateGradeDto) {
    return this.gradesService.create(req.user.workspaceId, dto);
  }

  @Post('defaults')
  @Roles(AppRoleValue.ADMIN)
  createDefaults(@Req() req: AuthenticatedRequest) {
    return this.gradesService.createDefaultGradesForWorkspace(req.user.workspaceId);
  }

  @Get()
  @Roles(AppRoleValue.ADMIN, AppRoleValue.EDITOR, AppRoleValue.VIEWER, AppRoleValue.FINANCE)
  findAll(@Req() req: AuthenticatedRequest) {
    return this.gradesService.findAll(req.user.workspaceId);
  }

  @Patch(':id')
  @Roles(AppRoleValue.ADMIN)
  update(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateGradeDto) {
    return this.gradesService.update(req.user.workspaceId, id, dto);
  }

  @Delete(':id')
  @Roles(AppRoleValue.ADMIN)
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.gradesService.remove(req.user.workspaceId, id);
  }
}
