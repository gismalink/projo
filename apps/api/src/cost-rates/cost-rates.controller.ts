import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AppRoleValue, Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateCostRateDto } from './dto/create-cost-rate.dto';
import { UpdateCostRateDto } from './dto/update-cost-rate.dto';
import { CostRatesService } from './cost-rates.service';

type AuthenticatedRequest = {
  user: {
    workspaceId: string;
  };
};

@Controller('cost-rates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CostRatesController {
  constructor(private readonly costRatesService: CostRatesService) {}

  @Post()
  @Roles(AppRoleValue.ADMIN, AppRoleValue.PM, AppRoleValue.FINANCE)
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateCostRateDto) {
    return this.costRatesService.create(req.user.workspaceId, dto);
  }

  @Get()
  @Roles(AppRoleValue.ADMIN, AppRoleValue.PM, AppRoleValue.VIEWER, AppRoleValue.FINANCE)
  findAll(@Req() req: AuthenticatedRequest) {
    return this.costRatesService.findAll(req.user.workspaceId);
  }

  @Get(':id')
  @Roles(AppRoleValue.ADMIN, AppRoleValue.PM, AppRoleValue.VIEWER, AppRoleValue.FINANCE)
  findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.costRatesService.findOne(req.user.workspaceId, id);
  }

  @Patch(':id')
  @Roles(AppRoleValue.ADMIN, AppRoleValue.PM, AppRoleValue.FINANCE)
  update(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateCostRateDto) {
    return this.costRatesService.update(req.user.workspaceId, id, dto);
  }

  @Delete(':id')
  @Roles(AppRoleValue.ADMIN, AppRoleValue.PM, AppRoleValue.FINANCE)
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.costRatesService.remove(req.user.workspaceId, id);
  }
}
