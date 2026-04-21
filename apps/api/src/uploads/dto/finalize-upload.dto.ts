import { IsOptional, IsString } from 'class-validator';

export class FinalizeUploadDto {
  @IsOptional()
  manifest?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  textCiphertextBody?: string;

  @IsOptional()
  @IsString()
  displayName?: string;
}
