import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateInstanceSettingsDto {
  @IsOptional()
  @IsString()
  publicOrigin?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  defaultStorageQuotaBytes?: number;
}
