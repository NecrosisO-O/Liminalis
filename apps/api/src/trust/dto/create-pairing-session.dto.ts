import { IsString } from 'class-validator';

export class CreatePairingSessionDto {
  @IsString()
  deviceLabel!: string;

  @IsString()
  devicePublicIdentity!: string;
}
