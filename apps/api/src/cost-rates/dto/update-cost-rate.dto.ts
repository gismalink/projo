import { PartialType } from '@nestjs/mapped-types';
import { CreateCostRateDto } from './create-cost-rate.dto';

export class UpdateCostRateDto extends PartialType(CreateCostRateDto) {}
