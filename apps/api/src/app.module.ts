import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { AssignmentsModule } from './assignments/assignments.module';
import { CalendarModule } from './calendar/calendar.module';
import { CostRatesModule } from './cost-rates/cost-rates.module';
import { DepartmentsModule } from './departments/departments.module';
import { EmployeesModule } from './employees/employees.module';
import { GradesModule } from './grades/grades.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './common/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { RolesModule } from './roles/roles.module';
import { SkillsModule } from './skills/skills.module';
import { TimelineModule } from './timeline/timeline.module';
import { TeamTemplatesModule } from './team-templates/team-templates.module';
import { UsersModule } from './users/users.module';
import { VacationsModule } from './vacations/vacations.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    DepartmentsModule,
    UsersModule,
    AuthModule,
    CalendarModule,
    RolesModule,
    SkillsModule,
    CostRatesModule,
    GradesModule,
    EmployeesModule,
    ProjectsModule,
    AssignmentsModule,
    TimelineModule,
    TeamTemplatesModule,
    VacationsModule,
    HealthModule,
  ],
})
export class AppModule {}
