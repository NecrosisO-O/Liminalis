import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class SetStorageQuotaDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  quotaBytes?: number;
}
