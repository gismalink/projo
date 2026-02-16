import { Module } from '@nestjs/common';
import { TeamTemplatesController } from './team-templates.controller';
import { TeamTemplatesService } from './team-templates.service';

@Module({
  controllers: [TeamTemplatesController],
  providers: [TeamTemplatesService],
  exports: [TeamTemplatesService],
})
export class TeamTemplatesModule {}
