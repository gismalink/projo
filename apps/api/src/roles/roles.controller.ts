import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AppRoleValue, Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesService } from './roles.service';

type AuthenticatedRequest = {
  user: {
    workspaceId: string;
  };
};

@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @Roles(AppRoleValue.ADMIN)
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateRoleDto) {
    return this.rolesService.create(req.user.workspaceId, dto);
  }

  @Post('defaults')
  @Roles(AppRoleValue.ADMIN)
  createDefaults(@Req() req: AuthenticatedRequest) {
    return this.rolesService.createDefaultRolesForWorkspace(req.user.workspaceId);
  }

  @Get()
  @Roles(AppRoleValue.ADMIN, AppRoleValue.PM, AppRoleValue.VIEWER, AppRoleValue.FINANCE)
  findAll(@Req() req: AuthenticatedRequest) {
    return this.rolesService.findAll(req.user.workspaceId);
  }

  @Patch(':id')
  @Roles(AppRoleValue.ADMIN)
  update(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.update(req.user.workspaceId, id, dto);
  }

  @Delete(':id')
  @Roles(AppRoleValue.ADMIN)
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.rolesService.remove(req.user.workspaceId, id);
  }
}
