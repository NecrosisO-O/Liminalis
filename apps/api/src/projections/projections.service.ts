import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProjectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveTimeline(userId: string) {
    return this.prisma.activeTimelineItemProjection.findMany({
      where: {
        ownerUserId: userId,
        currentRetrievable: true,
      },
      orderBy: { createdTime: 'desc' },
    });
  }

  async getHistory(userId: string) {
    return this.prisma.historyEntryProjection.findMany({
      where: {
        ownerUserId: userId,
      },
      orderBy: { createdTime: 'desc' },
    });
  }

  async search(userId: string, query: string) {
    const normalized = query.trim();

    if (!normalized) {
      return [];
    }

    return this.prisma.searchDocumentProjection.findMany({
      where: {
        ownerUserId: userId,
        OR: [
          { displayTitle: { contains: normalized, mode: 'insensitive' } },
          { visibleSummary: { contains: normalized, mode: 'insensitive' } },
          { sourceLabel: { contains: normalized, mode: 'insensitive' } },
          { visibleTypeLabel: { contains: normalized, mode: 'insensitive' } },
          { visibleStatusLabel: { contains: normalized, mode: 'insensitive' } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
    });
  }
}
