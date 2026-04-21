import { IsString } from 'class-validator';

export class ApproveUserDto {
  @IsString()
  userId!: string;
}
