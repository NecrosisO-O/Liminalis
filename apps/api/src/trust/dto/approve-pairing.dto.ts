import { IsObject, IsString } from 'class-validator';

export class ApprovePairingDto {
  @IsString()
  pairingSessionId!: string;

  @IsObject()
  approvalPackage!: Record<string, unknown>;
}
