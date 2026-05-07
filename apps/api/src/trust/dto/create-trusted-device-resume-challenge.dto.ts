import { IsString } from 'class-validator';

export class CreateTrustedDeviceResumeChallengeDto {
  @IsString()
  devicePublicIdentity!: string;
}
