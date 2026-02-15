import { IsString } from 'class-validator';

export class AddProjectMemberDto {
  @IsString()
  employeeId!: string;
}
