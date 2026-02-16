import { ArrayNotEmpty, ArrayUnique, IsArray, IsString, MaxLength } from 'class-validator';

export class CreateTeamTemplateDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  roleIds!: string[];
}
