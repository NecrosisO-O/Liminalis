import { IsString, Length } from 'class-validator';

export class RecoveryAttemptDto {
  @IsString()
  @Length(20, 20)
  recoveryCode!: string;

  @IsString()
  deviceLabel!: string;

  @IsString()
  devicePublicIdentity!: string;
}
