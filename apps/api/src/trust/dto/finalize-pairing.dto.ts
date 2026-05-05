import { IsString } from 'class-validator';

export class FinalizePairingDto {
  @IsString()
  pairingSessionId!: string;
}
