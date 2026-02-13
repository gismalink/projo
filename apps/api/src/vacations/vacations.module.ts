import { Module } from '@nestjs/common';
import { VacationsController } from './vacations.controller';
import { VacationsService } from './vacations.service';

@Module({
  controllers: [VacationsController],
  providers: [VacationsService],
})
export class VacationsModule {}
