import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateInstanceSettingsDto {
  @IsOptional()
  @IsString()
  publicOrigin?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  defaultStorageQuotaBytes?: number;
}
