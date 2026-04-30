import { IsEnum } from 'class-validator';
import { ConfidentialityLevel } from '../../../generated/prisma/index.js';

export class ChangeConfidentialityDto {
  @IsEnum(ConfidentialityLevel)
  confidentialityLevel!: ConfidentialityLevel;
}
