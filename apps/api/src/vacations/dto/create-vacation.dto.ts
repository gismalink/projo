import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateVacationDto {
  @IsString()
  employeeId!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
