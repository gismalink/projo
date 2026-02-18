import { Type } from 'class-transformer';
import { IsEmail, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateIf } from 'class-validator';

export class CreateEmployeeDto {
  @IsString()
  @MaxLength(200)
  fullName!: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsEmail()
  email?: string | null;

  @IsString()
  roleId!: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  grade?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  defaultCapacityHoursPerDay?: number;
}
