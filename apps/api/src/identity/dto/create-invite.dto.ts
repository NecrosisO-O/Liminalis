import { IsInt, Max, Min } from 'class-validator';

export class CreateInviteDto {
  @IsInt()
  @Min(5)
  @Max(240)
  expiresInMinutes!: number;
}
