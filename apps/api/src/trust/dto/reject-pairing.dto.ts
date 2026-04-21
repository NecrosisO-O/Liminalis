import { IsString } from 'class-validator';

export class RejectPairingDto {
  @IsString()
  pairingSessionId!: string;
}
