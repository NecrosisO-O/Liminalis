import { Injectable } from '@nestjs/common';
import {
  ConfidentialityLevel,
  ProjectionSourceType,
  SourceItem,
  SourceItemState,
  UploadContentKind,
} from '../../generated/prisma/index.js';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProjectionService {
  constructor(private readonly prisma: PrismaService) {}

  async projectSourceItem(sourceItemId: string) {
    const sourceItem = await this.prisma.sourceItem.findUnique({
      where: { id: sourceItemId },
      include: {
        ownerUser: true,
        groupManifest: true,
        uploadSession: {
          include: { parts: true },
        },
      },
    });

    if (!sourceItem) {
      return;
    }

    const visibility = this.buildSourceVisibility(sourceItem);
    const title = sourceItem.displayName ?? this.fallbackTitle(sourceItem.contentKind);

    await this.prisma.activeTimelineItemProjection.upsert({
      where: {
        ownerUserId_sourceObjectType_sourceObjectId: {
          ownerUserId: sourceItem.ownerUserId,
          sourceObjectType: ProjectionSourceType.SOURCE_ITEM,
          sourceObjectId: sourceItem.id,
        },
      },
      update: {
        displayTitle: title,
        visibleTypeLabel: visibility.visibleTypeLabel,
        visibleSizeBytes: visibility.visibleSizeBytes,
        groupedItemCount: visibility.groupedItemCount,
        sourceLabel: visibility.sourceLabel,
        activeStatusLabel: visibility.activeStatusLabel,
        confidentialityLevel: sourceItem.confidentialityLevel,
        currentRetrievable: visibility.currentRetrievable,
        visibleSummary: visibility.visibleSummary,
        createdTime: sourceItem.createdAt,
        validUntil: sourceItem.validUntil,
        projectedAt: new Date(),
      },
      create: {
        ownerUserId: sourceItem.ownerUserId,
        sourceObjectType: ProjectionSourceType.SOURCE_ITEM,
        sourceObjectId: sourceItem.id,
        sourceItemId: sourceItem.id,
        displayTitle: title,
        visibleTypeLabel: visibility.visibleTypeLabel,
        visibleSizeBytes: visibility.visibleSizeBytes,
        groupedItemCount: visibility.groupedItemCount,
        sourceLabel: visibility.sourceLabel,
        activeStatusLabel: visibility.activeStatusLabel,
        confidentialityLevel: sourceItem.confidentialityLevel,
        currentRetrievable: visibility.currentRetrievable,
        visibleSummary: visibility.visibleSummary,
        createdTime: sourceItem.createdAt,
        validUntil: sourceItem.validUntil,
      },
    });

    await this.prisma.historyEntryProjection.upsert({
      where: {
        ownerUserId_sourceObjectType_sourceObjectId: {
          ownerUserId: sourceItem.ownerUserId,
          sourceObjectType: ProjectionSourceType.SOURCE_ITEM,
          sourceObjectId: sourceItem.id,
        },
      },
      update: {
        displayTitle: title,
        visibleTypeLabel: visibility.visibleTypeLabel,
        sourceLabel: visibility.sourceLabel,
        confidentialityLevel: sourceItem.confidentialityLevel,
        retainedStatus: visibility.retainedStatus,
        retrievable: visibility.currentRetrievable,
        concreteReason: visibility.concreteReason,
        visibleSummary: visibility.visibleSummary,
        createdTime: sourceItem.createdAt,
        statusTime: visibility.statusTime,
        projectedAt: new Date(),
      },
      create: {
        ownerUserId: sourceItem.ownerUserId,
        sourceObjectType: ProjectionSourceType.SOURCE_ITEM,
        sourceObjectId: sourceItem.id,
        sourceItemId: sourceItem.id,
        displayTitle: title,
        visibleTypeLabel: visibility.visibleTypeLabel,
        sourceLabel: visibility.sourceLabel,
        confidentialityLevel: sourceItem.confidentialityLevel,
        retainedStatus: visibility.retainedStatus,
        retrievable: visibility.currentRetrievable,
        concreteReason: visibility.concreteReason,
        visibleSummary: visibility.visibleSummary,
        createdTime: sourceItem.createdAt,
        statusTime: visibility.statusTime,
      },
    });

    await this.prisma.searchDocumentProjection.upsert({
      where: {
        ownerUserId_sourceObjectType_sourceObjectId: {
          ownerUserId: sourceItem.ownerUserId,
          sourceObjectType: ProjectionSourceType.SOURCE_ITEM,
          sourceObjectId: sourceItem.id,
        },
      },
      update: {
        displayTitle: title,
        visibleSummary: visibility.visibleSummary,
        sourceLabel: visibility.sourceLabel,
        visibleTypeLabel: visibility.visibleTypeLabel,
        visibleStatusLabel: visibility.retainedStatus,
        confidentialityLevel: sourceItem.confidentialityLevel,
        retrievable: visibility.currentRetrievable,
        projectedAt: new Date(),
      },
      create: {
        ownerUserId: sourceItem.ownerUserId,
        sourceObjectType: ProjectionSourceType.SOURCE_ITEM,
        sourceObjectId: sourceItem.id,
        sourceItemId: sourceItem.id,
        displayTitle: title,
        visibleSummary: visibility.visibleSummary,
        sourceLabel: visibility.sourceLabel,
        visibleTypeLabel: visibility.visibleTypeLabel,
        visibleStatusLabel: visibility.retainedStatus,
        confidentialityLevel: sourceItem.confidentialityLevel,
        retrievable: visibility.currentRetrievable,
      },
    });
  }

  private buildSourceVisibility(
    sourceItem: SourceItem & {
      ownerUser: { username: string };
      groupManifest: { manifestJson: unknown } | null;
      uploadSession: { parts: Array<{ byteSize: number }> } | null;
    },
  ) {
    const visibleTypeLabel = this.visibleTypeLabel(sourceItem.contentKind, sourceItem.groupManifest !== null);
    const visibleSummary =
      sourceItem.contentKind === UploadContentKind.SELF_SPACE_TEXT
        ? sourceItem.displayName ?? null
        : null;
    const visibleSizeBytes =
      sourceItem.contentKind === UploadContentKind.SELF_SPACE_TEXT
        ? sourceItem.textCiphertextBody?.length ?? null
        : sourceItem.uploadSession?.parts.reduce((sum, part) => sum + part.byteSize, 0) ?? null;
    const groupedItemCount = sourceItem.groupManifest
      ? Array.isArray((sourceItem.groupManifest.manifestJson as { members?: unknown }).members)
        ? ((sourceItem.groupManifest.manifestJson as { members: unknown[] }).members.length ?? null)
        : null
      : null;

    const currentRetrievable = sourceItem.state === SourceItemState.ACTIVE;
    const retainedStatus =
      sourceItem.state === SourceItemState.ACTIVE
        ? 'active'
        : sourceItem.state === SourceItemState.EXPIRED
          ? 'expired'
          : sourceItem.state === SourceItemState.INVALIDATED
            ? 'invalidated'
            : 'purged';

    return {
      visibleTypeLabel,
      visibleSummary,
      visibleSizeBytes,
      groupedItemCount,
      sourceLabel: sourceItem.ownerUser.username,
      activeStatusLabel: currentRetrievable ? 'active' : retainedStatus,
      currentRetrievable,
      retainedStatus,
      concreteReason: currentRetrievable ? null : retainedStatus,
      statusTime: currentRetrievable ? null : sourceItem.updatedAt,
    };
  }

  private fallbackTitle(contentKind: UploadContentKind) {
    switch (contentKind) {
      case UploadContentKind.SELF_SPACE_TEXT:
        return 'text item';
      case UploadContentKind.GROUPED_CONTENT:
        return 'grouped item';
      default:
        return 'file item';
    }
  }

  private visibleTypeLabel(contentKind: UploadContentKind, isGrouped: boolean) {
    if (contentKind === UploadContentKind.SELF_SPACE_TEXT) {
      return 'text';
    }

    if (isGrouped || contentKind === UploadContentKind.GROUPED_CONTENT) {
      return 'grouped_content';
    }

    return 'file';
  }
}
