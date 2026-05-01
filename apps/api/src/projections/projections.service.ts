import { Injectable } from '@nestjs/common';
import { ProjectionSourceType } from '../../generated/prisma/index.js';
import { PrismaService } from '../prisma/prisma.service';

export type TimelineItemOrigin =
  | 'CURRENT_DEVICE'
  | 'OTHER_DEVICE'
  | 'INCOMING_SHARE';

@Injectable()
export class ProjectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveTimeline(userId: string, trustedDeviceId: string | null) {
    const items = await this.prisma.activeTimelineItemProjection.findMany({
      where: {
        ownerUserId: userId,
        currentRetrievable: true,
      },
      include: {
        sourceItem: {
          select: {
            createdByTrustedDeviceId: true,
          },
        },
      },
      orderBy: { createdTime: 'desc' },
    });

    return items.map((item) => {
      const { sourceItem, ...projection } = item;
      const origin: TimelineItemOrigin =
        item.sourceObjectType === ProjectionSourceType.SHARE_OBJECT
          ? 'INCOMING_SHARE'
          : sourceItem?.createdByTrustedDeviceId &&
              sourceItem.createdByTrustedDeviceId === trustedDeviceId
            ? 'CURRENT_DEVICE'
            : 'OTHER_DEVICE';

      return {
        ...projection,
        timelineOrigin: origin,
      };
    });
  }

  async getHistory(userId: string) {
    return this.prisma.historyEntryProjection.findMany({
      where: {
        ownerUserId: userId,
      },
      include: {
        sourceItem: {
          select: {
            validUntil: true,
          },
        },
        shareObject: {
          select: {
            validUntil: true,
          },
        },
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
          { sourceLabel: { contains: normalized, mode: 'insensitive' } },
          { visibleTypeLabel: { contains: normalized, mode: 'insensitive' } },
          { visibleStatusLabel: { contains: normalized, mode: 'insensitive' } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
    });
  }
}
