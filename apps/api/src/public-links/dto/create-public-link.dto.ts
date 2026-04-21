import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreatePublicLinkDto {
  @IsString()
  shareObjectId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  requestedValidityMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  requestedDownloadCount?: number;
}
