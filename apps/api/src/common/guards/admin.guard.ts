import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      sessionActor?: { role?: 'ADMIN' | 'REGULAR_USER' };
    }>();

    if (request.sessionActor?.role !== 'ADMIN') {
      throw new ForbiddenException('Admin role required');
    }

    return true;
  }
}
