import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AppRoleValue, Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateTeamTemplateDto } from './dto/create-team-template.dto';
import { UpdateTeamTemplateDto } from './dto/update-team-template.dto';
import { TeamTemplatesService } from './team-templates.service';

@Controller('team-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TeamTemplatesController {
  constructor(private readonly teamTemplatesService: TeamTemplatesService) {}

  @Post()
  @Roles(AppRoleValue.ADMIN)
  create(@Body() dto: CreateTeamTemplateDto) {
    return this.teamTemplatesService.create(dto);
  }

  @Get()
  @Roles(AppRoleValue.ADMIN, AppRoleValue.PM, AppRoleValue.VIEWER, AppRoleValue.FINANCE)
  findAll() {
    return this.teamTemplatesService.findAll();
  }

  @Patch(':id')
  @Roles(AppRoleValue.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateTeamTemplateDto) {
    return this.teamTemplatesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(AppRoleValue.ADMIN)
  remove(@Param('id') id: string) {
    return this.teamTemplatesService.remove(id);
  }
}
