import { Module, OnModuleInit } from '@nestjs/common';
import { SkillsController } from './skills.controller';
import { SkillsService } from './skills.service';

@Module({
  controllers: [SkillsController],
  providers: [SkillsService],
  exports: [SkillsService],
})
export class SkillsModule implements OnModuleInit {
  constructor(private readonly skillsService: SkillsService) {}

  async onModuleInit() {
    await this.skillsService.ensureDefaultSkills();
  }
}
