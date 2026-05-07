import { IsString } from 'class-validator';

export class RemoveUserDto {
  @IsString()
  userId!: string;

  @IsString()
  confirmUsername!: string;
}
