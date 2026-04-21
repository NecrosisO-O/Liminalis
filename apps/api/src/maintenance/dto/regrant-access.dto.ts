import { IsEnum, IsString } from 'class-validator';
import { ProtectedObjectType } from '../../../generated/prisma/index.js';

export class RegrantAccessDto {
  @IsEnum(ProtectedObjectType)
  protectedObjectType!: ProtectedObjectType;

  @IsString()
  protectedObjectId!: string;
}
