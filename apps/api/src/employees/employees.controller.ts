import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AppRoleValue, Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { ImportEmployeesCsvDto } from './dto/import-employees-csv.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeesService } from './employees.service';

type AuthenticatedRequest = {
  user: {
    workspaceId: string;
  };
};

@Controller('employees')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @Roles(AppRoleValue.ADMIN, AppRoleValue.PM)
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(req.user.workspaceId, dto);
  }

  @Post('import-csv')
  @Roles(AppRoleValue.ADMIN, AppRoleValue.PM)
  importCsv(@Req() req: AuthenticatedRequest, @Body() dto: ImportEmployeesCsvDto) {
    return this.employeesService.importCsv(req.user.workspaceId, dto.csv);
  }

  @Get()
  @Roles(AppRoleValue.ADMIN, AppRoleValue.PM, AppRoleValue.VIEWER, AppRoleValue.FINANCE)
  findAll(@Req() req: AuthenticatedRequest) {
    return this.employeesService.findAll(req.user.workspaceId);
  }

  @Patch(':id')
  @Roles(AppRoleValue.ADMIN, AppRoleValue.PM)
  update(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.employeesService.update(req.user.workspaceId, id, dto);
  }

  @Delete(':id')
  @Roles(AppRoleValue.ADMIN)
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.employeesService.remove(req.user.workspaceId, id);
  }
}
