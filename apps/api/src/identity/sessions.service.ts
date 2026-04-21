import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SessionsService {
  private readonly absoluteTtlMs = 30 * 24 * 60 * 60 * 1000;

  private readonly idleTtlMs = 7 * 24 * 60 * 60 * 1000;

  constructor(private readonly prisma: PrismaService) {}

  async createSession(userId: string) {
    const now = new Date();

    return this.prisma.session.create({
      data: {
        userId,
        token: randomUUID(),
        expiresAt: new Date(now.getTime() + this.absoluteTtlMs),
        idleExpiresAt: new Date(now.getTime() + this.idleTtlMs),
      },
    });
  }

  async validateToken(token: string) {
    const session = await this.prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session) {
      return null;
    }

    const now = new Date();
    if (session.expiresAt < now || session.idleExpiresAt < now) {
      await this.prisma.session.delete({ where: { id: session.id } }).catch(() => null);
      return null;
    }

    if (session.user.enablementState === 'DISABLED') {
      return null;
    }

    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        lastActivityAt: now,
        idleExpiresAt: new Date(now.getTime() + this.idleTtlMs),
      },
    });

    return session;
  }

  async destroySession(token: string) {
    return this.prisma.session.deleteMany({ where: { token } });
  }
}
