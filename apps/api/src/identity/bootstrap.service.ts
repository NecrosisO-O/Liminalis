import { Injectable } from '@nestjs/common';
import { AdmissionState, EnablementState } from '../../generated/prisma/index.js';
import { IdentityService } from './identity.service';

@Injectable()
export class BootstrapService {
  constructor(private readonly identityService: IdentityService) {}

  async getBootstrapState(userId: string) {
    const user = await this.identityService.getUserById(userId);

    if (user.enablementState === EnablementState.DISABLED) {
      return {
        accountState: 'blocked',
        trustState: 'none',
        requiresFirstDeviceBootstrap: false,
      } as const;
    }

    if (user.admissionState === AdmissionState.PENDING_APPROVAL) {
      return {
        accountState: 'waiting_approval',
        trustState: 'none',
        requiresFirstDeviceBootstrap: false,
      } as const;
    }

    const trustedDevices = user.devices.filter((device) => device.trustState === 'TRUSTED');
    const requiresFirstDeviceBootstrap = trustedDevices.length === 0;

    return {
      accountState: 'active',
      trustState: requiresFirstDeviceBootstrap ? 'untrusted' : 'trusted',
      requiresFirstDeviceBootstrap,
      hasRecoverySet: Boolean(user.recoverySet),
      hasCurrentWrappingKey: user.wrappingKeys.length > 0,
    } as const;
  }
}
