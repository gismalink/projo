import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateCostRateDto {
  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsString()
  roleId?: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amountPerHour!: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @IsDateString()
  validFrom!: string;

  @IsOptional()
  @IsDateString()
  validTo?: string;
}
