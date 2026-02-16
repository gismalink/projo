import { PartialType } from '@nestjs/mapped-types';
import { ArrayNotEmpty, ArrayUnique, IsArray, IsOptional, IsString } from 'class-validator';
import { CreateTeamTemplateDto } from './create-team-template.dto';

export class UpdateTeamTemplateDto extends PartialType(CreateTeamTemplateDto) {
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  roleIds?: string[];
}
