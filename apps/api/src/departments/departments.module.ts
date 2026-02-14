import { Module, OnModuleInit } from '@nestjs/common';
import { DepartmentsController } from './departments.controller';
import { DepartmentsService } from './departments.service';

@Module({
  controllers: [DepartmentsController],
  providers: [DepartmentsService],
  exports: [DepartmentsService],
})
export class DepartmentsModule implements OnModuleInit {
  constructor(private readonly departmentsService: DepartmentsService) {}

  async onModuleInit() {
    await this.departmentsService.ensureDefaultDepartments();
  }
}
