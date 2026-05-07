import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class RegisterUploadPartDto {
  @IsInt()
  @Min(1)
  partNumber!: number;

  @IsString()
  storageKey!: string;

  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  byteSize!: number;

  @IsOptional()
  @IsString()
  checksum?: string;
}
