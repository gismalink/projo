import { IsString, MinLength } from 'class-validator';

export class SwitchProjectSpaceDto {
  @IsString()
  @MinLength(1)
  projectId!: string;
}
