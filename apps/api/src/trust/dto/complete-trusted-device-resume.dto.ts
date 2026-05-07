import { IsString } from 'class-validator';

export class CompleteTrustedDeviceResumeDto {
  @IsString()
  challengeId!: string;

  @IsString()
  signature!: string;
}
