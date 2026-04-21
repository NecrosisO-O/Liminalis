import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import {
  AdmissionState,
  EnablementState,
  UserRole,
} from '../../generated/prisma/index.js';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class IdentityService {
  constructor(private readonly prisma: PrismaService) {}

  async register(input: RegisterDto) {
    const invite = await this.prisma.inviteCode.findUnique({
      where: { code: input.inviteCode },
    });

    if (!invite || invite.invalidatedAt || invite.consumedAt || invite.expiresAt < new Date()) {
      throw new BadRequestException('Invite code is invalid');
    }

    const existing = await this.prisma.user.findUnique({
      where: { username: input.username },
    });

    if (existing) {
      throw new BadRequestException('Username already exists');
    }

    const passwordHash = await argon2.hash(input.password);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          username: input.username,
          email: input.email,
          passwordHash,
          role: UserRole.REGULAR_USER,
          admissionState: AdmissionState.PENDING_APPROVAL,
          enablementState: EnablementState.ENABLED,
        },
      });

      await tx.inviteCode.update({
        where: { id: invite.id },
        data: {
          consumedAt: new Date(),
          consumedById: created.id,
        },
      });

      return created;
    });

    return {
      id: user.id,
      username: user.username,
      admissionState: user.admissionState,
      enablementState: user.enablementState,
    };
  }

  async validateCredentials(input: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { username: input.username },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await argon2.verify(user.passwordHash, input.password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }

  async getUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        devices: true,
        recoverySet: true,
        wrappingKeys: {
          where: { isCurrent: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async createInvite(createdById: string, expiresInMinutes: number) {
    return this.prisma.inviteCode.create({
      data: {
        code: crypto.randomUUID(),
        createdById,
        expiresAt: new Date(Date.now() + expiresInMinutes * 60_000),
      },
    });
  }

  async listPendingUsers() {
    return this.prisma.user.findMany({
      where: { admissionState: AdmissionState.PENDING_APPROVAL },
      orderBy: { createdAt: 'asc' },
    });
  }

  async approveUser(userId: string, adminId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        admissionState: AdmissionState.APPROVED,
        approvedAt: new Date(),
        approvedById: adminId,
      },
    });
  }

  async disableUser(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { enablementState: EnablementState.DISABLED },
    });
  }

  async enableUser(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { enablementState: EnablementState.ENABLED },
    });
  }
}
