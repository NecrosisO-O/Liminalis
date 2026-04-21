import { IsBoolean } from 'class-validator';

export class ConfirmLiveTransferDto {
  @IsBoolean()
  confirmed!: boolean;
}
