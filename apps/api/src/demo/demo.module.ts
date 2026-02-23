import { Module } from '@nestjs/common';
import { DepartmentsModule } from '../departments/departments.module';
import { GradesModule } from '../grades/grades.module';
import { PrismaModule } from '../common/prisma.module';
import { RolesModule } from '../roles/roles.module';
import { DemoController } from './demo.controller';
import { DemoService } from './demo.service';

@Module({
  imports: [PrismaModule, RolesModule, DepartmentsModule, GradesModule],
  controllers: [DemoController],
  providers: [DemoService],
})
export class DemoModule {}
