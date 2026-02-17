import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';

export class InviteProjectMemberDto {
  @IsString()
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  @IsIn(['viewer', 'editor'])
  permission!: 'viewer' | 'editor';
}
