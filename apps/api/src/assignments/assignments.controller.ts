import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AppRoleValue, Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AssignmentsService } from './assignments.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';

type AuthenticatedRequest = {
  user: {
    workspaceId: string;
  };
};

@Controller('assignments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Post()
  @Roles(AppRoleValue.ADMIN, AppRoleValue.EDITOR)
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateAssignmentDto) {
    return this.assignmentsService.create(req.user.workspaceId, dto);
  }

  @Get()
  @Roles(AppRoleValue.ADMIN, AppRoleValue.EDITOR, AppRoleValue.VIEWER, AppRoleValue.FINANCE)
  findAll(@Req() req: AuthenticatedRequest) {
    return this.assignmentsService.findAll(req.user.workspaceId);
  }

  @Get(':id')
  @Roles(AppRoleValue.ADMIN, AppRoleValue.EDITOR, AppRoleValue.VIEWER, AppRoleValue.FINANCE)
  findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.assignmentsService.findOne(req.user.workspaceId, id);
  }

  @Patch(':id')
  @Roles(AppRoleValue.ADMIN, AppRoleValue.EDITOR)
  update(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateAssignmentDto) {
    return this.assignmentsService.update(req.user.workspaceId, id, dto);
  }

  @Delete(':id')
  @Roles(AppRoleValue.ADMIN)
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.assignmentsService.remove(req.user.workspaceId, id);
  }
}
