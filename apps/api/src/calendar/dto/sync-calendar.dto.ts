import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class SyncCalendarDto {
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(2000, { each: true })
  @Max(2100, { each: true })
  years?: number[];

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  force?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeNextYear?: boolean;
}
