import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AppRoleValue, Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateTeamTemplateDto } from './dto/create-team-template.dto';
import { UpdateTeamTemplateDto } from './dto/update-team-template.dto';
import { TeamTemplatesService } from './team-templates.service';

type AuthenticatedRequest = {
  user: {
    workspaceId: string;
  };
};

@Controller('team-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TeamTemplatesController {
  constructor(private readonly teamTemplatesService: TeamTemplatesService) {}

  @Post()
  @Roles(AppRoleValue.ADMIN)
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateTeamTemplateDto) {
    return this.teamTemplatesService.create(req.user.workspaceId, dto);
  }

  @Post('defaults')
  @Roles(AppRoleValue.ADMIN)
  createDefaults(@Req() req: AuthenticatedRequest) {
    return this.teamTemplatesService.createDefaultTemplatesForWorkspace(req.user.workspaceId);
  }

  @Get()
  @Roles(AppRoleValue.ADMIN, AppRoleValue.EDITOR, AppRoleValue.VIEWER, AppRoleValue.FINANCE)
  findAll(@Req() req: AuthenticatedRequest) {
    return this.teamTemplatesService.findAll(req.user.workspaceId);
  }

  @Patch(':id')
  @Roles(AppRoleValue.ADMIN)
  update(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateTeamTemplateDto) {
    return this.teamTemplatesService.update(req.user.workspaceId, id, dto);
  }

  @Delete(':id')
  @Roles(AppRoleValue.ADMIN)
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.teamTemplatesService.remove(req.user.workspaceId, id);
  }
}
