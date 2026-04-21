import { IsBoolean } from 'class-validator';

export class CompleteRetrievalDto {
  @IsBoolean()
  success!: boolean;
}
