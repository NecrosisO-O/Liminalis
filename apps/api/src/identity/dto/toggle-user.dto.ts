import { IsString } from 'class-validator';

export class ToggleUserDto {
  @IsString()
  userId!: string;
}
