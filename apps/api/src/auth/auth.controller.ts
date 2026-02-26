import { Body, Controller, Delete, Get, GoneException, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { ErrorCode } from '../common/error-codes';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { CreateProjectSpaceDto } from './dto/create-project-space.dto';
import { InviteProjectMemberDto } from './dto/invite-project-member.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SwitchCompanyDto } from './dto/switch-company.dto';
import { SwitchProjectSpaceDto } from './dto/switch-project-space.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
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
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private isLocalAuthEnabled() {
    const raw = this.configService.get<string>('LOCAL_AUTH_ENABLED');
    if (raw === undefined) return true;
    const normalized = raw.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }

  private assertLocalAuthEnabled() {
    if (!this.isLocalAuthEnabled()) {
      throw new GoneException(ErrorCode.AUTH_LOCAL_AUTH_DISABLED);
    }
  }

  @Post('login')
  @Throttle({ login: { limit: 15, ttl: 60 } })
  login(@Body() dto: LoginDto) {
    this.assertLocalAuthEnabled();
    return this.authService.login(dto.email, dto.password);
  }

  @Post('register')
  register(@Body() dto: RegisterDto) {
    this.assertLocalAuthEnabled();
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
  @Get('companies')
  getCompanies(@Req() req: AuthenticatedRequest) {
    return this.authService.getMyCompanies(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/overview')
  getAdminOverview(@Req() req: AuthenticatedRequest) {
    return this.authService.getAdminOverview(req.user.userId, req.user.workspaceId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('companies')
  createCompany(@Req() req: AuthenticatedRequest, @Body() dto: CreateCompanyDto) {
    return this.authService.createCompany(req.user.userId, dto.name);
  }

  @UseGuards(JwtAuthGuard)
  @Post('companies/switch')
  switchCompany(@Req() req: AuthenticatedRequest, @Body() dto: SwitchCompanyDto) {
    return this.authService.switchCompany(req.user.userId, dto.companyId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('companies/:companyId')
  updateCompanyName(
    @Req() req: AuthenticatedRequest,
    @Param('companyId') companyId: string,
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.authService.updateCompanyName(req.user.userId, companyId, dto.name);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('companies/:companyId')
  deleteCompany(@Req() req: AuthenticatedRequest, @Param('companyId') companyId: string) {
    return this.authService.deleteCompany(req.user.userId, companyId);
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
  @Delete('projects/:projectId')
  deleteProject(@Req() req: AuthenticatedRequest, @Param('projectId') projectId: string) {
    return this.authService.deleteProjectSpace(req.user.userId, projectId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('projects/:projectId/copy')
  copyProject(
    @Req() req: AuthenticatedRequest,
    @Param('projectId') projectId: string,
    @Body() dto: CreateProjectSpaceDto,
  ) {
    return this.authService.copyProjectSpace(req.user.userId, projectId, dto.name);
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
