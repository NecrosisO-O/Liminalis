import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateExtractionDto {
  @IsString()
  sourceItemId!: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  requestedValidityMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  requestedRetrievalCount?: number;

  @IsOptional()
  @IsObject()
  packageReference?: Record<string, unknown>;
}
