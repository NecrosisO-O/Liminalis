import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateShareDto {
  @IsString()
  sourceItemId!: string;

  @IsString()
  recipientUsername!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  requestedValidityMinutes?: number;
}
