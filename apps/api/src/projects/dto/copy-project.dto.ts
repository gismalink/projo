import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CopyProjectDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;
}
