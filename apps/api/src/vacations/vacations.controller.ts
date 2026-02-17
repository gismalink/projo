import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AppRoleValue, Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateVacationDto } from './dto/create-vacation.dto';
import { UpdateVacationDto } from './dto/update-vacation.dto';
import { VacationsService } from './vacations.service';

@Controller('vacations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VacationsController {
  constructor(private readonly vacationsService: VacationsService) {}

  @Post()
  @Roles(AppRoleValue.ADMIN)
  create(@Body() dto: CreateVacationDto) {
    return this.vacationsService.create(dto);
  }

  @Get()
  @Roles(AppRoleValue.ADMIN, AppRoleValue.PM, AppRoleValue.VIEWER, AppRoleValue.FINANCE)
  findAll() {
    return this.vacationsService.findAll();
  }

  @Get(':id')
  @Roles(AppRoleValue.ADMIN, AppRoleValue.PM, AppRoleValue.VIEWER, AppRoleValue.FINANCE)
  findOne(@Param('id') id: string) {
    return this.vacationsService.findOne(id);
  }

  @Patch(':id')
  @Roles(AppRoleValue.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateVacationDto) {
    return this.vacationsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(AppRoleValue.ADMIN)
  remove(@Param('id') id: string) {
    return this.vacationsService.remove(id);
  }
}
