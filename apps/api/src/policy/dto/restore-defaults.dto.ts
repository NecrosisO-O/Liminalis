import { IsEnum, IsOptional } from 'class-validator';
import { ConfidentialityLevel } from '../../../generated/prisma/index.js';

export class RestoreDefaultsDto {
  @IsOptional()
  @IsEnum(ConfidentialityLevel)
  defaultConfidentialityLevel?: ConfidentialityLevel;
}
