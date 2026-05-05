import { IsObject, IsOptional, IsString } from 'class-validator';

export class FinalizeUploadDto {
  @IsOptional()
  @IsObject()
  manifest?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  textCiphertextBody?: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  cryptoVersion?: string;

  @IsOptional()
  @IsObject()
  encryptedMetadata?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  contentCryptoMetadata?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  ownerKeyEnvelope?: Record<string, unknown>;
}
