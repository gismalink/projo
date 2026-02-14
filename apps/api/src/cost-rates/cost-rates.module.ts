import { Module } from '@nestjs/common';
import { CostRatesController } from './cost-rates.controller';
import { CostRatesService } from './cost-rates.service';

@Module({
  controllers: [CostRatesController],
  providers: [CostRatesService],
})
export class CostRatesModule {}
