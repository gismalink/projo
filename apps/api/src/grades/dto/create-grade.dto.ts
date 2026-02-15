import { IsString, MaxLength } from 'class-validator';

export class CreateGradeDto {
  @IsString()
  @MaxLength(100)
  name!: string;
}
