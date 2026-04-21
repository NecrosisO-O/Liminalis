import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedSession } from '../types/auth.types';

export const SessionActor = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedSession | null => {
    const request = ctx.switchToHttp().getRequest<{ sessionActor?: AuthenticatedSession }>();
    return request.sessionActor ?? null;
  },
);
