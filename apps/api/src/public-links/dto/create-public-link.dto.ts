import { IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class CreatePublicLinkDto {
  @IsString()
  sourceItemId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  requestedValidityMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  requestedDownloadCount?: number;

  @IsOptional()
  @IsObject()
  packageReference?: Record<string, unknown>;
}
