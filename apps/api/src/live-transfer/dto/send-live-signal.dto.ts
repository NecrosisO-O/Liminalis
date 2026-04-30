import { IsObject, IsString } from 'class-validator';

export class SendLiveSignalDto {
  @IsString()
  kind!: string;

  @IsObject()
  payload!: Record<string, unknown>;
}
