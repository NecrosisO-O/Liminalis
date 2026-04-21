import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { ConfidentialityLevel, UploadContentKind } from '../../../generated/prisma/index.js';

export class CreateLiveTransferDto {
  @IsString()
  contentLabel!: string;

  @IsEnum(UploadContentKind)
  contentKind!: UploadContentKind;

  @IsOptional()
  @IsEnum(ConfidentialityLevel)
  confidentialityLevel?: ConfidentialityLevel;

  @IsOptional()
  @IsBoolean()
  groupedTransfer?: boolean;
}
