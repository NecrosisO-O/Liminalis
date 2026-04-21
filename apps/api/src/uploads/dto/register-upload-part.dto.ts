import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class RegisterUploadPartDto {
  @IsInt()
  @Min(1)
  partNumber!: number;

  @IsString()
  storageKey!: string;

  @IsInt()
  @Min(1)
  byteSize!: number;

  @IsOptional()
  @IsString()
  checksum?: string;
}
