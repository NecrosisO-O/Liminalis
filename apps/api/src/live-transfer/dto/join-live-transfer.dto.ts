import { IsString } from 'class-validator';

export class JoinLiveTransferDto {
  @IsString()
  sessionCode!: string;
}
