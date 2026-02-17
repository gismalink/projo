import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AppRoleValue, Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateSkillDto } from './dto/create-skill.dto';
import { UpdateSkillDto } from './dto/update-skill.dto';
import { SkillsService } from './skills.service';

@Controller('skills')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Post()
  @Roles(AppRoleValue.ADMIN)
  create(@Body() dto: CreateSkillDto) {
    return this.skillsService.create(dto);
  }

  @Get()
  @Roles(AppRoleValue.ADMIN, AppRoleValue.PM, AppRoleValue.VIEWER, AppRoleValue.FINANCE)
  findAll() {
    return this.skillsService.findAll();
  }

  @Patch(':id')
  @Roles(AppRoleValue.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateSkillDto) {
    return this.skillsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(AppRoleValue.ADMIN)
  remove(@Param('id') id: string) {
    return this.skillsService.remove(id);
  }

  @Post(':id/employees/:employeeId')
  @Roles(AppRoleValue.ADMIN)
  assignToEmployee(@Param('id') id: string, @Param('employeeId') employeeId: string) {
    return this.skillsService.assignToEmployee(id, employeeId);
  }

  @Delete(':id/employees/:employeeId')
  @Roles(AppRoleValue.ADMIN)
  unassignFromEmployee(@Param('id') id: string, @Param('employeeId') employeeId: string) {
    return this.skillsService.unassignFromEmployee(id, employeeId);
  }
}
