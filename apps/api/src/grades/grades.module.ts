import { Module, OnModuleInit } from '@nestjs/common';
import { GradesController } from './grades.controller';
import { GradesService } from './grades.service';

@Module({
  controllers: [GradesController],
  providers: [GradesService],
  exports: [GradesService],
})
export class GradesModule implements OnModuleInit {
  constructor(private readonly gradesService: GradesService) {}

  async onModuleInit() {
    await this.gradesService.ensureDefaultGrades();
  }
}
