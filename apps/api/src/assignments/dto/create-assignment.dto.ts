import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { AssignmentLoadProfileDto } from './load-profile.dto';

export class CreateAssignmentDto {
  @IsString()
  projectId!: string;

  @IsString()
  employeeId!: string;

  @IsDateString()
  assignmentStartDate!: string;

  @IsDateString()
  assignmentEndDate!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  allocationPercent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  plannedHoursPerDay?: number;

  @IsOptional()
  @IsString()
  roleOnProject?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AssignmentLoadProfileDto)
  loadProfile?: AssignmentLoadProfileDto;
}
