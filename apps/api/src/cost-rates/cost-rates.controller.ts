import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AppRoleValue, Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateCostRateDto } from './dto/create-cost-rate.dto';
import { UpdateCostRateDto } from './dto/update-cost-rate.dto';
import { CostRatesService } from './cost-rates.service';

@Controller('cost-rates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CostRatesController {
  constructor(private readonly costRatesService: CostRatesService) {}

  @Post()
  @Roles(AppRoleValue.ADMIN, AppRoleValue.FINANCE)
  create(@Body() dto: CreateCostRateDto) {
    return this.costRatesService.create(dto);
  }

  @Get()
  @Roles(AppRoleValue.ADMIN, AppRoleValue.PM, AppRoleValue.VIEWER, AppRoleValue.FINANCE)
  findAll() {
    return this.costRatesService.findAll();
  }

  @Get(':id')
  @Roles(AppRoleValue.ADMIN, AppRoleValue.PM, AppRoleValue.VIEWER, AppRoleValue.FINANCE)
  findOne(@Param('id') id: string) {
    return this.costRatesService.findOne(id);
  }

  @Patch(':id')
  @Roles(AppRoleValue.ADMIN, AppRoleValue.FINANCE)
  update(@Param('id') id: string, @Body() dto: UpdateCostRateDto) {
    return this.costRatesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(AppRoleValue.ADMIN, AppRoleValue.FINANCE)
  remove(@Param('id') id: string) {
    return this.costRatesService.remove(id);
  }
}
