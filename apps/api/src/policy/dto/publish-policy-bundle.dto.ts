import { Type } from 'class-transformer';
import { IsEnum, IsObject, IsOptional, ValidateNested } from 'class-validator';
import { ConfidentialityLevel } from '../../../generated/prisma/index.js';

class PolicySectionDto {
  @IsObject()
  value!: Record<string, boolean | number | string | null>;
}

export class PublishPolicyBundleDto {
  @IsEnum(ConfidentialityLevel)
  levelName!: ConfidentialityLevel;

  @ValidateNested()
  @Type(() => PolicySectionDto)
  lifecycle!: PolicySectionDto;

  @ValidateNested()
  @Type(() => PolicySectionDto)
  shareAvailability!: PolicySectionDto;

  @ValidateNested()
  @Type(() => PolicySectionDto)
  userTargetedSharing!: PolicySectionDto;

  @ValidateNested()
  @Type(() => PolicySectionDto)
  passwordExtraction!: PolicySectionDto;

  @ValidateNested()
  @Type(() => PolicySectionDto)
  publicLinks!: PolicySectionDto;

  @ValidateNested()
  @Type(() => PolicySectionDto)
  liveTransfer!: PolicySectionDto;

  @IsOptional()
  @IsEnum(ConfidentialityLevel)
  defaultConfidentialityLevel?: ConfidentialityLevel;
}
