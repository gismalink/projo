import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { AssignmentsModule } from './assignments/assignments.module';
import { CostRatesModule } from './cost-rates/cost-rates.module';
import { DepartmentsModule } from './departments/departments.module';
import { EmployeesModule } from './employees/employees.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './common/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { RolesModule } from './roles/roles.module';
import { SkillsModule } from './skills/skills.module';
import { TimelineModule } from './timeline/timeline.module';
import { UsersModule } from './users/users.module';
import { VacationsModule } from './vacations/vacations.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    DepartmentsModule,
    UsersModule,
    AuthModule,
    RolesModule,
    SkillsModule,
    CostRatesModule,
    EmployeesModule,
    ProjectsModule,
    AssignmentsModule,
    TimelineModule,
    VacationsModule,
    HealthModule,
  ],
})
export class AppModule {}
