import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsIn, IsNumber, IsOptional, Max, Min, ValidateNested } from 'class-validator';

export const ASSIGNMENT_LOAD_PROFILE_MODE_VALUES = ['flat', 'curve'] as const;
export type AssignmentLoadProfileModeValue = (typeof ASSIGNMENT_LOAD_PROFILE_MODE_VALUES)[number];

export class AssignmentLoadProfilePointDto {
  @IsDateString()
  date!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  value!: number;
}

export class AssignmentLoadProfileDto {
  @IsIn(ASSIGNMENT_LOAD_PROFILE_MODE_VALUES)
  mode!: AssignmentLoadProfileModeValue;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssignmentLoadProfilePointDto)
  points?: AssignmentLoadProfilePointDto[];
}
