import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { SessionsService } from '../../identity/sessions.service';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sessionsService: SessionsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      cookies?: Record<string, string>;
      sessionActor?: {
        sessionId: string;
        userId: string;
        role: 'ADMIN' | 'REGULAR_USER';
        admissionState: 'PENDING_APPROVAL' | 'APPROVED';
        enablementState: 'ENABLED' | 'DISABLED';
        trustedDeviceId: string | null;
      };
    }>();

    const token = request.cookies?.liminalis_session;
    if (!token) {
      throw new UnauthorizedException('Missing session');
    }

    const session = await this.sessionsService.validateToken(token);
    if (!session) {
      throw new UnauthorizedException('Invalid session');
    }

    const trustedDeviceId = request.cookies?.liminalis_trusted_device ?? null;

    request.sessionActor = {
      sessionId: session.id,
      userId: session.userId,
      role: session.user.role,
      admissionState: session.user.admissionState,
      enablementState: session.user.enablementState,
      trustedDeviceId,
    };

    return true;
  }
}
