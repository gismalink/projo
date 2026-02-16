import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @MaxLength(50)
  code!: string;

  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  priority?: number;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  links?: string[];

  @IsOptional()
  @IsString()
  teamTemplateId?: string;
}
