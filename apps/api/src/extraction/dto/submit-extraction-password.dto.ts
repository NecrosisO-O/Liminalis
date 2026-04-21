import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class SubmitExtractionPasswordDto {
  @IsString()
  @MinLength(1)
  password!: string;

  @IsOptional()
  @IsBoolean()
  captchaSatisfied?: boolean;
}
