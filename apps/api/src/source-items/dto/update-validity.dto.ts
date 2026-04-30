import { IsInt, IsOptional, Min } from 'class-validator';

export class UpdateValidityDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  requestedValidityMinutes?: number;
}
