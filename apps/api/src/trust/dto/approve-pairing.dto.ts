import { IsString } from 'class-validator';

export class ApprovePairingDto {
  @IsString()
  pairingSessionId!: string;
}
