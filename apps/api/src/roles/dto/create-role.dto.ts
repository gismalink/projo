import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  level?: number;

  @IsOptional()
  @IsString()
  @MaxLength(7)
  colorHex?: string;
}
