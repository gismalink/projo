import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateProjectSpaceDto } from './dto/create-project-space.dto';
import { InviteProjectMemberDto } from './dto/invite-project-member.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SwitchProjectSpaceDto } from './dto/switch-project-space.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { UpdateProjectMemberPermissionDto } from './dto/update-project-member-permission.dto';
import { UpdateProjectSpaceDto } from './dto/update-project-space.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

type AuthenticatedRequest = {
  user: {
    userId: string;
    workspaceId: string;
  };
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.email, dto.fullName, dto.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: AuthenticatedRequest) {
    return this.authService.getMe(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateMe(@Req() req: AuthenticatedRequest, @Body() dto: UpdateMeDto) {
    return this.authService.updateMe(req.user.userId, dto.fullName);
  }

  @UseGuards(JwtAuthGuard)
  @Get('projects')
  getProjects(@Req() req: AuthenticatedRequest) {
    return this.authService.getMyProjects(req.user.userId, req.user.workspaceId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('projects')
  createProject(@Req() req: AuthenticatedRequest, @Body() dto: CreateProjectSpaceDto) {
    return this.authService.createProjectSpace(req.user.userId, dto.name);
  }

  @UseGuards(JwtAuthGuard)
  @Post('projects/switch')
  switchProject(@Req() req: AuthenticatedRequest, @Body() dto: SwitchProjectSpaceDto) {
    return this.authService.switchProjectSpace(req.user.userId, dto.projectId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('projects/:projectId')
  updateProjectName(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Body() dto: UpdateProjectSpaceDto,
  ) {
    return this.authService.updateProjectSpaceName(req.user.userId, projectId, dto.name);
  }

  @UseGuards(JwtAuthGuard)
  @Get('projects/:projectId/members')
  getProjectMembers(@Req() req: AuthenticatedRequest, @Param('projectId') projectId: string) {
    return this.authService.getProjectMembers(req.user.userId, projectId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('projects/:projectId/invite')
  inviteProjectMember(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Body() dto: InviteProjectMemberDto,
  ) {
    return this.authService.inviteProjectMember(req.user.userId, projectId, dto.email, dto.permission);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('projects/:projectId/members/:targetUserId')
  updateProjectMemberPermission(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('targetUserId') targetUserId: string,
    @Body() dto: UpdateProjectMemberPermissionDto,
  ) {
    return this.authService.updateProjectMemberPermission(req.user.userId, projectId, targetUserId, dto.permission);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('projects/:projectId/members/:targetUserId')
  removeProjectMember(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Param('targetUserId') targetUserId: string,
  ) {
    return this.authService.removeProjectMember(req.user.userId, projectId, targetUserId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  changePassword(@Req() req: AuthenticatedRequest, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(req.user.userId, dto.currentPassword, dto.newPassword);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout() {
    return this.authService.logout();
  }
}
