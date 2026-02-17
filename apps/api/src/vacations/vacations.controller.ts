import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AppRoleValue, Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateVacationDto } from './dto/create-vacation.dto';
import { UpdateVacationDto } from './dto/update-vacation.dto';
import { VacationsService } from './vacations.service';

type AuthenticatedRequest = {
  user: {
    workspaceId: string;
  };
};

@Controller('vacations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VacationsController {
  constructor(private readonly vacationsService: VacationsService) {}

  @Post()
  @Roles(AppRoleValue.ADMIN)
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateVacationDto) {
    return this.vacationsService.create(req.user.workspaceId, dto);
  }

  @Get()
  @Roles(AppRoleValue.ADMIN, AppRoleValue.PM, AppRoleValue.VIEWER, AppRoleValue.FINANCE)
  findAll(@Req() req: AuthenticatedRequest) {
    return this.vacationsService.findAll(req.user.workspaceId);
  }

  @Get(':id')
  @Roles(AppRoleValue.ADMIN, AppRoleValue.PM, AppRoleValue.VIEWER, AppRoleValue.FINANCE)
  findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.vacationsService.findOne(req.user.workspaceId, id);
  }

  @Patch(':id')
  @Roles(AppRoleValue.ADMIN)
  update(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateVacationDto) {
    return this.vacationsService.update(req.user.workspaceId, id, dto);
  }

  @Delete(':id')
  @Roles(AppRoleValue.ADMIN)
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.vacationsService.remove(req.user.workspaceId, id);
  }
}
