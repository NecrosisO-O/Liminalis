import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class TrustedDeviceGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      sessionActor?: {
        admissionState?: 'PENDING_APPROVAL' | 'APPROVED';
        enablementState?: 'ENABLED' | 'DISABLED';
        trustedDeviceId?: string | null;
      };
    }>();

    const actor = request.sessionActor;

    if (!actor || actor.enablementState !== 'ENABLED') {
      throw new ForbiddenException('Enabled account required');
    }

    if (actor.admissionState !== 'APPROVED') {
      throw new ForbiddenException('Approved account required');
    }

    if (!actor.trustedDeviceId) {
      throw new ForbiddenException('Trusted device required');
    }

    return true;
  }
}
