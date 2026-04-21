import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  ConfidentialityLevel,
  GroupStructureKind,
  UploadContentKind,
} from '../../../generated/prisma/index.js';

export class PrepareUploadDto {
  @IsEnum(UploadContentKind)
  contentKind!: UploadContentKind;

  @IsOptional()
  @IsEnum(GroupStructureKind)
  groupStructureKind?: GroupStructureKind;

  @IsOptional()
  @IsEnum(ConfidentialityLevel)
  confidentialityLevel?: ConfidentialityLevel;

  @IsOptional()
  @IsInt()
  @Min(0)
  requestedValidityMinutes?: number;

  @IsOptional()
  @IsBoolean()
  burnAfterReadEnabled?: boolean;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsObject()
  manifest?: Record<string, unknown>;
}
