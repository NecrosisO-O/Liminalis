import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccessGrantStatus,
  AccessGrantSubjectMode,
  DeviceTrustState,
  PackageFamilyKind,
  ProtectedObjectType,
} from '../../generated/prisma/index.js';
import { PrismaService } from '../prisma/prisma.service';
import { RegrantAccessDto } from './dto/regrant-access.dto';

@Injectable()
export class MaintenanceService {
  constructor(private readonly prisma: PrismaService) {}

  async removeTrustedAccess(userId: string, trustedDeviceId: string | null) {
    if (!trustedDeviceId) {
      throw new ForbiddenException('Trusted device required');
    }

    const device = await this.prisma.trustedDevice.findUnique({ where: { id: trustedDeviceId } });
    if (!device || device.userId !== userId) {
      throw new NotFoundException('Trusted device not found');
    }

    return this.prisma.trustedDevice.update({
      where: { id: trustedDeviceId },
      data: {
        trustState: DeviceTrustState.UNTRUSTED,
        trustEstablishedAt: null,
      },
    });
  }

  async regrantSnapshotAccess(userId: string, input: RegrantAccessDto) {
    const trustedDevices = await this.prisma.trustedDevice.findMany({
      where: { userId, trustState: DeviceTrustState.TRUSTED },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    if (trustedDevices.length === 0) {
      throw new BadRequestException('No trusted devices available for regrant');
    }

    if (input.protectedObjectType === ProtectedObjectType.SOURCE_ITEM) {
      return this.regrantSourceItem(userId, input.protectedObjectId, trustedDevices.map((device) => device.id));
    }

    if (input.protectedObjectType === ProtectedObjectType.SHARE_OBJECT) {
      return this.regrantShareObject(userId, input.protectedObjectId, trustedDevices.map((device) => device.id));
    }

    throw new BadRequestException('Unsupported protected object type for regrant');
  }

  private async regrantSourceItem(userId: string, sourceItemId: string, trustedDeviceIds: string[]) {
    const sourceItem = await this.prisma.sourceItem.findFirst({
      where: { id: sourceItemId, ownerUserId: userId },
      include: {
        accessGrantSets: {
          where: { status: AccessGrantStatus.CURRENT },
          include: { ordinaryPackageFamily: true, recoveryPackageFamily: true },
        },
      },
    });

    if (!sourceItem) {
      throw new NotFoundException('Source item not found');
    }

    const currentGrant = sourceItem.accessGrantSets[0];
    if (!currentGrant) {
      throw new BadRequestException('Current access grant not found');
    }

    if (currentGrant.grantSubjectMode !== AccessGrantSubjectMode.OWNER_DEVICE_SNAPSHOT) {
      throw new BadRequestException('Source item is not snapshot-mode access');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.accessGrantSet.update({
        where: { id: currentGrant.id },
        data: {
          status: AccessGrantStatus.SUPERSEDED,
          supersededAt: new Date(),
        },
      });

      const ordinaryPackageFamily = await tx.packageFamily.create({
        data: {
          protectedObjectType: ProtectedObjectType.SOURCE_ITEM,
          protectedObjectId: sourceItem.id,
          sourceItemId: sourceItem.id,
          kind: PackageFamilyKind.OWNER_ORDINARY,
          familyVersion: currentGrant.ordinaryPackageFamily.familyVersion + 1,
          issueTrigger: 'device_regrant',
          referenceBlob: {
            packageFamily: 'owner_ordinary',
            sourceItemId: sourceItem.id,
            contentKind: sourceItem.contentKind,
            trustedDeviceIds,
          },
        },
      });

      return tx.accessGrantSet.create({
        data: {
          version: currentGrant.version + 1,
          protectedObjectType: ProtectedObjectType.SOURCE_ITEM,
          sourceItemId: sourceItem.id,
          status: AccessGrantStatus.CURRENT,
          grantSubjectMode: AccessGrantSubjectMode.OWNER_DEVICE_SNAPSHOT,
          subjectUserId: userId,
          snapshotDeviceIds: trustedDeviceIds,
          ordinaryPackageFamilyId: ordinaryPackageFamily.id,
          recoveryEnabled: currentGrant.recoveryEnabled,
          recoveryPackageFamilyId: currentGrant.recoveryPackageFamilyId,
          confidentialityLevel: currentGrant.confidentialityLevel,
          allowFutureTrustedDevices: currentGrant.allowFutureTrustedDevices,
          allowRecipientMultiDeviceAccess: currentGrant.allowRecipientMultiDeviceAccess,
          issueTrigger: 'device_regrant',
          supersedesAccessGrantSetId: currentGrant.id,
        },
      });
    });
  }

  private async regrantShareObject(userId: string, shareObjectId: string, trustedDeviceIds: string[]) {
    const shareObject = await this.prisma.shareObject.findFirst({
      where: { id: shareObjectId, recipientUserId: userId },
      include: {
        accessGrantSets: {
          where: { status: AccessGrantStatus.CURRENT },
          include: { ordinaryPackageFamily: true, recoveryPackageFamily: true },
        },
      },
    });

    if (!shareObject) {
      throw new NotFoundException('Share object not found');
    }

    const currentGrant = shareObject.accessGrantSets[0];
    if (!currentGrant) {
      throw new BadRequestException('Current access grant not found');
    }

    if (currentGrant.grantSubjectMode !== AccessGrantSubjectMode.RECIPIENT_DEVICE_SNAPSHOT) {
      throw new BadRequestException('Share object is not snapshot-mode access');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.accessGrantSet.update({
        where: { id: currentGrant.id },
        data: {
          status: AccessGrantStatus.SUPERSEDED,
          supersededAt: new Date(),
        },
      });

      const ordinaryPackageFamily = await tx.packageFamily.create({
        data: {
          protectedObjectType: ProtectedObjectType.SHARE_OBJECT,
          protectedObjectId: shareObject.id,
          shareObjectId: shareObject.id,
          kind: PackageFamilyKind.RECIPIENT_ORDINARY,
          familyVersion: currentGrant.ordinaryPackageFamily.familyVersion + 1,
          issueTrigger: 'device_regrant',
          referenceBlob: {
            packageFamily: 'recipient_ordinary',
            shareObjectId: shareObject.id,
            recipientUserId: userId,
            trustedDeviceIds,
          },
        },
      });

      return tx.accessGrantSet.create({
        data: {
          version: currentGrant.version + 1,
          protectedObjectType: ProtectedObjectType.SHARE_OBJECT,
          shareObjectId: shareObject.id,
          status: AccessGrantStatus.CURRENT,
          grantSubjectMode: AccessGrantSubjectMode.RECIPIENT_DEVICE_SNAPSHOT,
          subjectUserId: userId,
          snapshotDeviceIds: trustedDeviceIds,
          ordinaryPackageFamilyId: ordinaryPackageFamily.id,
          recoveryEnabled: currentGrant.recoveryEnabled,
          recoveryPackageFamilyId: currentGrant.recoveryPackageFamilyId,
          confidentialityLevel: currentGrant.confidentialityLevel,
          allowFutureTrustedDevices: currentGrant.allowFutureTrustedDevices,
          allowRecipientMultiDeviceAccess: currentGrant.allowRecipientMultiDeviceAccess,
          issueTrigger: 'device_regrant',
          supersedesAccessGrantSetId: currentGrant.id,
        },
      });
    });
  }
}
