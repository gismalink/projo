import { Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AppRoleValue, Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { DemoService } from './demo.service';

type AuthenticatedRequest = {
  user: {
    workspaceId: string;
  };
};

@Controller('demo')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DemoController {
  constructor(private readonly demoService: DemoService) {}

  @Post('seed')
  @Roles(AppRoleValue.ADMIN)
  seed(@Req() req: AuthenticatedRequest) {
    return this.demoService.seedDemoWorkspace(req.user.workspaceId);
  }
}
