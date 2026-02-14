import { IsString, MinLength } from 'class-validator';

export class ImportEmployeesCsvDto {
  @IsString()
  @MinLength(1)
  csv!: string;
}
