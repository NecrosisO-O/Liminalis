import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateExtractionDto {
  @IsString()
  shareObjectId!: string;

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
}
