import { IsIn, IsString, MinLength } from 'class-validator';

export class UpdateProjectMemberPermissionDto {
  @IsString()
  @MinLength(1)
  @IsIn(['viewer', 'editor'])
  permission!: 'viewer' | 'editor';
}
