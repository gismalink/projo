import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AppRoleValue, Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @Roles(AppRoleValue.ADMIN, AppRoleValue.PM)
  create(@Body() dto: CreateProjectDto) {
    return this.projectsService.create(dto);
  }

  @Get()
  @Roles(AppRoleValue.ADMIN, AppRoleValue.PM, AppRoleValue.VIEWER, AppRoleValue.FINANCE)
  findAll() {
    return this.projectsService.findAll();
  }

  @Get(':id')
  @Roles(AppRoleValue.ADMIN, AppRoleValue.PM, AppRoleValue.VIEWER, AppRoleValue.FINANCE)
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @Get(':id/members')
  @Roles(AppRoleValue.ADMIN, AppRoleValue.PM, AppRoleValue.VIEWER, AppRoleValue.FINANCE)
  listMembers(@Param('id') id: string) {
    return this.projectsService.listMembers(id);
  }

  @Post(':id/members')
  @Roles(AppRoleValue.ADMIN, AppRoleValue.PM)
  addMember(@Param('id') id: string, @Body() dto: AddProjectMemberDto) {
    return this.projectsService.addMember(id, dto.employeeId);
  }

  @Delete(':id/members/:employeeId')
  @Roles(AppRoleValue.ADMIN, AppRoleValue.PM)
  removeMember(@Param('id') id: string, @Param('employeeId') employeeId: string) {
    return this.projectsService.removeMember(id, employeeId);
  }

  @Patch(':id')
  @Roles(AppRoleValue.ADMIN, AppRoleValue.PM)
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projectsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(AppRoleValue.ADMIN)
  remove(@Param('id') id: string) {
    return this.projectsService.remove(id);
  }
}
