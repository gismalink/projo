import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateDepartmentDto {
	@IsOptional()
	@IsString()
	@MaxLength(100)
	name?: string;

	@IsOptional()
	@IsString()
	description?: string;

	@IsOptional()
	@IsString()
	@MaxLength(7)
	colorHex?: string;
}
