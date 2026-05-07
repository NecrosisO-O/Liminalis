import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class SetStorageQuotaDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  quotaBytes?: number;
}
