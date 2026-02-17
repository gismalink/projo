import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AppRoleValue, Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

type AuthenticatedRequest = {
  user: {
    workspaceId: string;
  };
};

@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @Roles(AppRoleValue.ADMIN, AppRoleValue.PM)
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(req.user.workspaceId, dto);
  }

  @Get()
  @Roles(AppRoleValue.ADMIN, AppRoleValue.PM, AppRoleValue.VIEWER, AppRoleValue.FINANCE)
  findAll(@Req() req: AuthenticatedRequest) {
    return this.projectsService.findAll(req.user.workspaceId);
  }

  @Get(':id')
  @Roles(AppRoleValue.ADMIN, AppRoleValue.PM, AppRoleValue.VIEWER, AppRoleValue.FINANCE)
  findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.projectsService.findOne(req.user.workspaceId, id);
  }

  @Get(':id/members')
  @Roles(AppRoleValue.ADMIN, AppRoleValue.PM, AppRoleValue.VIEWER, AppRoleValue.FINANCE)
  listMembers(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.projectsService.listMembers(req.user.workspaceId, id);
  }

  @Post(':id/members')
  @Roles(AppRoleValue.ADMIN, AppRoleValue.PM)
  addMember(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: AddProjectMemberDto) {
    return this.projectsService.addMember(req.user.workspaceId, id, dto.employeeId);
  }

  @Delete(':id/members/:employeeId')
  @Roles(AppRoleValue.ADMIN, AppRoleValue.PM)
  removeMember(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Param('employeeId') employeeId: string) {
    return this.projectsService.removeMember(req.user.workspaceId, id, employeeId);
  }

  @Patch(':id')
  @Roles(AppRoleValue.ADMIN, AppRoleValue.PM)
  update(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projectsService.update(req.user.workspaceId, id, dto);
  }

  @Delete(':id')
  @Roles(AppRoleValue.ADMIN)
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.projectsService.remove(req.user.workspaceId, id);
  }
}
