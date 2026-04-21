import { IsString } from 'class-validator';

export class FirstDeviceBootstrapDto {
  @IsString()
  deviceLabel!: string;

  @IsString()
  userDomainPublicKey!: string;

  @IsString()
  devicePublicIdentity!: string;
}
