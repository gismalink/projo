import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateGradeDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(7)
  colorHex?: string;
}
