import { IsEnum } from 'class-validator';
import { LiveTransferTransportState } from '../../../generated/prisma/index.js';

export class UpdateLiveTransportDto {
  @IsEnum(LiveTransferTransportState)
  transportState!: LiveTransferTransportState;
}
