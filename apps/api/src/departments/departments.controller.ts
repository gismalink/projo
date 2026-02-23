import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AppRoleValue, Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { DepartmentsService } from './departments.service';

type AuthenticatedRequest = {
  user: {
    workspaceId: string;
  };
};

@Controller('departments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Post()
  @Roles(AppRoleValue.ADMIN)
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateDepartmentDto) {
    return this.departmentsService.create(req.user.workspaceId, dto);
  }

  @Post('defaults')
  @Roles(AppRoleValue.ADMIN)
  createDefaults(@Req() req: AuthenticatedRequest) {
    return this.departmentsService.createDefaultDepartmentsForWorkspace(req.user.workspaceId);
  }

  @Get()
  @Roles(AppRoleValue.ADMIN, AppRoleValue.EDITOR, AppRoleValue.VIEWER, AppRoleValue.FINANCE)
  findAll(@Req() req: AuthenticatedRequest) {
    return this.departmentsService.findAll(req.user.workspaceId);
  }

  @Patch(':id')
  @Roles(AppRoleValue.ADMIN)
  update(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
    return this.departmentsService.update(req.user.workspaceId, id, dto);
  }

  @Delete(':id')
  @Roles(AppRoleValue.ADMIN)
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.departmentsService.remove(req.user.workspaceId, id);
  }
}
