import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AppRoleValue, Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { ImportEmployeesCsvDto } from './dto/import-employees-csv.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeesService } from './employees.service';

@Controller('employees')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @Roles(AppRoleValue.ADMIN, AppRoleValue.PM)
  create(@Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(dto);
  }

  @Post('import-csv')
  @Roles(AppRoleValue.ADMIN, AppRoleValue.PM)
  importCsv(@Body() dto: ImportEmployeesCsvDto) {
    return this.employeesService.importCsv(dto.csv);
  }

  @Get()
  @Roles(AppRoleValue.ADMIN, AppRoleValue.PM, AppRoleValue.VIEWER, AppRoleValue.FINANCE)
  findAll() {
    return this.employeesService.findAll();
  }

  @Patch(':id')
  @Roles(AppRoleValue.ADMIN, AppRoleValue.PM)
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.employeesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(AppRoleValue.ADMIN)
  remove(@Param('id') id: string) {
    return this.employeesService.remove(id);
  }
}
