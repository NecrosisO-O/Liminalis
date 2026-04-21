import { IsString } from 'class-validator';

export class InvalidateInviteDto {
  @IsString()
  inviteId!: string;
}
