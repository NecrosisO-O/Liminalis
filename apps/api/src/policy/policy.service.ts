import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import {
  ConfidentialityLevel,
  Prisma,
  PolicyBundle,
  UploadContentKind,
} from '../../generated/prisma/index.js';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_CONFIDENTIALITY_LEVEL,
  POLICY_BUNDLE_DEFAULTS,
  type PolicyBundleSeed,
} from './policy-defaults';
import {
  type ExtractionCreationPolicyDecision,
  type ExtractionCreationPolicyInput,
  type LiveTransferCreationPolicyDecision,
  type LiveTransferCreationPolicyInput,
  type PublicLinkCreationPolicyDecision,
  type PublicLinkCreationPolicyInput,
  type ShareCreationPolicyDecision,
  type ShareCreationPolicyInput,
  type SourceCreationPolicyDecision,
  type SourceCreationPolicyInput,
} from './policy.types';

@Injectable()
export class PolicyService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureInstanceSetting();

    for (const seed of POLICY_BUNDLE_DEFAULTS) {
      await this.ensureCurrentBundle(seed);
    }
  }

  async getDefaultConfidentialityLevel() {
    const setting = await this.ensureInstanceSetting();
    return setting.defaultConfidentialityLevel;
  }

  async getCurrentBundle(levelName: ConfidentialityLevel) {
    const bundle = await this.prisma.policyBundle.findFirst({
      where: { levelName, isCurrent: true },
      orderBy: { bundleVersion: 'desc' },
    });

    if (!bundle) {
      throw new BadRequestException(`No current policy bundle for ${levelName}`);
    }

    return bundle;
  }

  async evaluateSourceCreation(
    input: SourceCreationPolicyInput,
  ): Promise<SourceCreationPolicyDecision> {
    const bundle = await this.getCurrentBundle(input.confidentialityLevel);
    const lifecycle = bundle.lifecycle as Record<string, boolean | number | null>;
    const shareAvailability = bundle.shareAvailability as Record<string, boolean | number | null>;

    const defaultValidityMinutes = Number(lifecycle.defaultValidityMinutes);
    const maximumValidityMinutes = this.toNullableNumber(lifecycle.maximumValidityMinutes);
    const allowNeverExpire = Boolean(lifecycle.allowNeverExpire);

    let resolvedValidityMinutes: number | null = input.requestedValidityMinutes;

    if (resolvedValidityMinutes == null) {
      resolvedValidityMinutes = defaultValidityMinutes;
    }

    if (resolvedValidityMinutes === 0 && !allowNeverExpire) {
      throw new BadRequestException('Never-expire validity is not allowed for this level');
    }

    if (resolvedValidityMinutes !== 0 && resolvedValidityMinutes !== null && resolvedValidityMinutes <= 0) {
      throw new BadRequestException('Validity must be greater than zero when provided');
    }

    if (
      maximumValidityMinutes !== null &&
      resolvedValidityMinutes !== 0 &&
      resolvedValidityMinutes !== null &&
      resolvedValidityMinutes > maximumValidityMinutes
    ) {
      throw new BadRequestException('Requested validity exceeds the policy maximum');
    }

    if (
      input.contentKind === UploadContentKind.SELF_SPACE_TEXT &&
      Boolean(shareAvailability.allowOutwardSharing) === false
    ) {
      // Text stays in self space in v1, but the policy output still needs a stable snapshot.
    }

    return {
      allowed: true,
      decisionReason: 'allowed',
      policyBundle: bundle,
      resolvedValidityMinutes,
      snapshotFieldsToPersist: {
        confidentialityLevel: input.confidentialityLevel,
        burnAfterReadEnabled: input.burnAfterReadEnabled,
        defaultValidityMinutes,
        requestedValidityMinutes: input.requestedValidityMinutes,
        resolvedValidityMinutes,
        allowFutureTrustedDevices: Boolean(lifecycle.allowFutureTrustedDevices),
        allowOutwardResharing: Boolean(lifecycle.allowOutwardResharing),
        policyBundleVersion: bundle.bundleVersion,
      },
    };
  }

  async listCurrentBundles() {
    return this.prisma.policyBundle.findMany({
      where: { isCurrent: true },
      orderBy: { levelName: 'asc' },
    });
  }

  async listBundleHistory(levelName: ConfidentialityLevel) {
    return this.prisma.policyBundle.findMany({
      where: { levelName },
      orderBy: [{ bundleVersion: 'desc' }],
    });
  }

  async getPolicyAdminState() {
    const [setting, bundles] = await Promise.all([
      this.ensureInstanceSetting(),
      this.listCurrentBundles(),
    ]);

    return {
      defaultConfidentialityLevel: setting.defaultConfidentialityLevel,
      currentBundles: bundles,
    };
  }

  async publishBundle(
    adminUserId: string,
    levelName: ConfidentialityLevel,
    input: {
      lifecycle: Record<string, boolean | number | string | null>;
      shareAvailability: Record<string, boolean | number | string | null>;
      userTargetedSharing: Record<string, boolean | number | string | null>;
      passwordExtraction: Record<string, boolean | number | string | null>;
      publicLinks: Record<string, boolean | number | string | null>;
      liveTransfer: Record<string, boolean | number | string | null>;
      defaultConfidentialityLevel?: ConfidentialityLevel;
    },
  ) {
    this.validateBundleSections(input);

    const current = await this.getCurrentBundle(levelName);

    return this.prisma.$transaction(async (tx) => {
      await tx.policyBundle.updateMany({
        where: { levelName, isCurrent: true },
        data: { isCurrent: false },
      });

      const created = await tx.policyBundle.create({
        data: {
          levelName,
          bundleVersion: current.bundleVersion + 1,
          isCurrent: true,
          updatedByAdminId: adminUserId,
          lifecycle: input.lifecycle as Prisma.InputJsonValue,
          shareAvailability: input.shareAvailability as Prisma.InputJsonValue,
          userTargetedSharing: input.userTargetedSharing as Prisma.InputJsonValue,
          passwordExtraction: input.passwordExtraction as Prisma.InputJsonValue,
          publicLinks: input.publicLinks as Prisma.InputJsonValue,
          liveTransfer: input.liveTransfer as Prisma.InputJsonValue,
        },
      });

      if (input.defaultConfidentialityLevel) {
        await tx.instanceSetting.update({
          where: { singletonKey: 'default' },
          data: { defaultConfidentialityLevel: input.defaultConfidentialityLevel },
        });
      }

      return created;
    });
  }

  async restoreDefaults(adminUserId: string, defaultConfidentialityLevel?: ConfidentialityLevel) {
    const createdBundles = await this.prisma.$transaction(async (tx) => {
      const bundles: PolicyBundle[] = [];

      for (const seed of POLICY_BUNDLE_DEFAULTS) {
        const current = await tx.policyBundle.findFirst({
          where: { levelName: seed.levelName, isCurrent: true },
          orderBy: { bundleVersion: 'desc' },
        });

        await tx.policyBundle.updateMany({
          where: { levelName: seed.levelName, isCurrent: true },
          data: { isCurrent: false },
        });

        const created = await tx.policyBundle.create({
          data: {
            levelName: seed.levelName,
            bundleVersion: (current?.bundleVersion ?? 0) + 1,
            isCurrent: true,
            updatedByAdminId: adminUserId,
            lifecycle: seed.lifecycle as Prisma.InputJsonValue,
            shareAvailability: seed.shareAvailability as Prisma.InputJsonValue,
            userTargetedSharing: seed.userTargetedSharing as Prisma.InputJsonValue,
            passwordExtraction: seed.passwordExtraction as Prisma.InputJsonValue,
            publicLinks: seed.publicLinks as Prisma.InputJsonValue,
            liveTransfer: seed.liveTransfer as Prisma.InputJsonValue,
          },
        });

        bundles.push(created);
      }

      await tx.instanceSetting.update({
        where: { singletonKey: 'default' },
        data: {
          defaultConfidentialityLevel:
            defaultConfidentialityLevel ?? DEFAULT_CONFIDENTIALITY_LEVEL,
        },
      });

      return bundles;
    });

    return {
      defaultConfidentialityLevel: defaultConfidentialityLevel ?? DEFAULT_CONFIDENTIALITY_LEVEL,
      bundles: createdBundles,
    };
  }

  async evaluateShareCreation(
    input: ShareCreationPolicyInput,
  ): Promise<ShareCreationPolicyDecision> {
    const bundle = await this.getCurrentBundle(input.confidentialityLevel);
    const shareAvailability = bundle.shareAvailability as Record<string, boolean | number | null>;
    const userTargetedSharing = bundle.userTargetedSharing as Record<string, boolean | number | null>;

    if (!Boolean(shareAvailability.allowOutwardSharing)) {
      throw new BadRequestException('Outward sharing is not allowed for this level');
    }

    if (!Boolean(shareAvailability.allowUserTargetedSharing)) {
      throw new BadRequestException('User-targeted sharing is not allowed for this level');
    }

    const defaultShareValidityMinutes = Number(userTargetedSharing.defaultShareValidityMinutes);
    const maximumShareValidityMinutes = this.toNullableNumber(
      userTargetedSharing.maximumShareValidityMinutes,
    );

    let resolvedValidityMinutes = input.requestedValidityMinutes;

    if (resolvedValidityMinutes == null) {
      resolvedValidityMinutes = defaultShareValidityMinutes;
    }

    if (resolvedValidityMinutes !== null && resolvedValidityMinutes <= 0) {
      throw new BadRequestException('Share validity must be greater than zero when provided');
    }

    if (
      maximumShareValidityMinutes !== null &&
      resolvedValidityMinutes !== null &&
      resolvedValidityMinutes > maximumShareValidityMinutes
    ) {
      throw new BadRequestException('Requested share validity exceeds the policy maximum');
    }

    const allowRepeatDownload = Boolean(userTargetedSharing.allowRepeatDownload);
    const allowRecipientMultiDeviceAccess = Boolean(
      userTargetedSharing.allowRecipientMultiDeviceAccess,
    );

    return {
      allowed: true,
      decisionReason: 'allowed',
      policyBundle: bundle,
      resolvedValidityMinutes,
      allowRepeatDownload,
      allowRecipientMultiDeviceAccess,
      snapshotFieldsToPersist: {
        confidentialityLevel: input.confidentialityLevel,
        requestedValidityMinutes: input.requestedValidityMinutes,
        resolvedValidityMinutes,
        allowRepeatDownload,
        allowRecipientMultiDeviceAccess,
        policyBundleVersion: bundle.bundleVersion,
      },
    };
  }

  async evaluateExtractionCreation(
    input: ExtractionCreationPolicyInput,
  ): Promise<ExtractionCreationPolicyDecision> {
    const bundle = await this.getCurrentBundle(input.confidentialityLevel);
    const shareAvailability = bundle.shareAvailability as Record<string, boolean | number | null>;
    const passwordExtraction = bundle.passwordExtraction as Record<string, boolean | number | null>;

    if (!Boolean(shareAvailability.allowOutwardSharing)) {
      throw new BadRequestException('Outward sharing is not allowed for this level');
    }

    if (!Boolean(shareAvailability.allowPasswordExtraction)) {
      throw new BadRequestException('Password extraction is not allowed for this level');
    }

    const maximumRetrievalCount = this.toNullableNumber(passwordExtraction.maximumRetrievalCount);
    const requireSystemGeneratedPassword = Boolean(
      passwordExtraction.requireSystemGeneratedPassword,
    );
    const resolvedValidityMinutes = input.requestedValidityMinutes;
    const resolvedRetrievalCount = input.requestedRetrievalCount ?? 1;

    if (resolvedValidityMinutes !== null && resolvedValidityMinutes <= 0) {
      throw new BadRequestException('Extraction validity must be greater than zero when provided');
    }

    if (resolvedRetrievalCount <= 0) {
      throw new BadRequestException('Extraction retrieval count must be greater than zero');
    }

    if (maximumRetrievalCount !== null && resolvedRetrievalCount > maximumRetrievalCount) {
      throw new BadRequestException('Requested extraction retrieval count exceeds the policy maximum');
    }

    return {
      allowed: true,
      decisionReason: 'allowed',
      policyBundle: bundle,
      resolvedValidityMinutes,
      resolvedRetrievalCount,
      requireSystemGeneratedPassword,
      snapshotFieldsToPersist: {
        confidentialityLevel: input.confidentialityLevel,
        requestedValidityMinutes: input.requestedValidityMinutes,
        resolvedValidityMinutes,
        requestedRetrievalCount: input.requestedRetrievalCount,
        resolvedRetrievalCount,
        requireSystemGeneratedPassword,
        policyBundleVersion: bundle.bundleVersion,
      },
    };
  }

  async evaluatePublicLinkCreation(
    input: PublicLinkCreationPolicyInput,
  ): Promise<PublicLinkCreationPolicyDecision> {
    const bundle = await this.getCurrentBundle(input.confidentialityLevel);
    const shareAvailability = bundle.shareAvailability as Record<string, boolean | number | null>;
    const publicLinks = bundle.publicLinks as Record<string, boolean | number | null>;

    if (!Boolean(shareAvailability.allowOutwardSharing)) {
      throw new BadRequestException('Outward sharing is not allowed for this level');
    }

    if (!Boolean(shareAvailability.allowPublicLinks)) {
      throw new BadRequestException('Public links are not allowed for this level');
    }

    const maximumPublicLinkValidityMinutes = this.toNullableNumber(
      publicLinks.maximumPublicLinkValidityMinutes,
    );
    const maximumPublicLinkDownloadCount = this.toNullableNumber(
      publicLinks.maximumPublicLinkDownloadCount,
    );

    const resolvedValidityMinutes = input.requestedValidityMinutes;
    const resolvedDownloadCount = input.requestedDownloadCount ?? 1;

    if (resolvedValidityMinutes !== null && resolvedValidityMinutes <= 0) {
      throw new BadRequestException('Public-link validity must be greater than zero when provided');
    }

    if (resolvedDownloadCount <= 0) {
      throw new BadRequestException('Public-link download count must be greater than zero');
    }

    if (
      maximumPublicLinkValidityMinutes !== null &&
      resolvedValidityMinutes !== null &&
      resolvedValidityMinutes > maximumPublicLinkValidityMinutes
    ) {
      throw new BadRequestException('Requested public-link validity exceeds the policy maximum');
    }

    if (
      maximumPublicLinkDownloadCount !== null &&
      resolvedDownloadCount > maximumPublicLinkDownloadCount
    ) {
      throw new BadRequestException('Requested public-link download count exceeds the policy maximum');
    }

    return {
      allowed: true,
      decisionReason: 'allowed',
      policyBundle: bundle,
      resolvedValidityMinutes,
      resolvedDownloadCount,
      snapshotFieldsToPersist: {
        confidentialityLevel: input.confidentialityLevel,
        requestedValidityMinutes: input.requestedValidityMinutes,
        resolvedValidityMinutes,
        requestedDownloadCount: input.requestedDownloadCount,
        resolvedDownloadCount,
        policyBundleVersion: bundle.bundleVersion,
      },
    };
  }

  async evaluateLiveTransferCreation(
    input: LiveTransferCreationPolicyInput,
  ): Promise<LiveTransferCreationPolicyDecision> {
    const bundle = await this.getCurrentBundle(input.confidentialityLevel);
    const liveTransfer = bundle.liveTransfer as Record<string, boolean | number | null>;

    if (!Boolean(liveTransfer.allowLiveTransfer)) {
      throw new BadRequestException('Live transfer is not allowed for this level');
    }

    if (input.contentKind === UploadContentKind.SELF_SPACE_TEXT) {
      throw new BadRequestException('Live transfer does not support self-space text');
    }

    const allowGroupedOrLargeLiveTransfer = Boolean(liveTransfer.allowGroupedOrLargeLiveTransfer);
    if (input.groupedTransfer && !allowGroupedOrLargeLiveTransfer) {
      throw new BadRequestException('Grouped or large live transfer is not allowed for this level');
    }

    const allowPeerToPeer = Boolean(liveTransfer.allowPeerToPeer);
    const allowRelay = Boolean(liveTransfer.allowRelay);
    const allowPeerToPeerToRelayFallback = Boolean(
      liveTransfer.allowPeerToPeerToRelayFallback,
    );
    const allowLiveToStoredFallback = Boolean(liveTransfer.allowLiveToStoredFallback);
    const retainLiveTransferRecords = Boolean(liveTransfer.retainLiveTransferRecords);

    return {
      allowed: true,
      decisionReason: 'allowed',
      policyBundle: bundle,
      allowPeerToPeer,
      allowRelay,
      allowPeerToPeerToRelayFallback,
      allowLiveToStoredFallback,
      retainLiveTransferRecords,
      allowGroupedOrLargeLiveTransfer,
      snapshotFieldsToPersist: {
        confidentialityLevel: input.confidentialityLevel,
        allowPeerToPeer,
        allowRelay,
        allowPeerToPeerToRelayFallback,
        allowLiveToStoredFallback,
        retainLiveTransferRecords,
        allowGroupedOrLargeLiveTransfer,
        policyBundleVersion: bundle.bundleVersion,
      },
    };
  }

  private async ensureCurrentBundle(seed: PolicyBundleSeed) {
    const existing = await this.prisma.policyBundle.findFirst({
      where: { levelName: seed.levelName, isCurrent: true },
      orderBy: { bundleVersion: 'desc' },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.policyBundle.create({
      data: {
        levelName: seed.levelName,
        bundleVersion: 1,
        isCurrent: true,
        lifecycle: seed.lifecycle,
        shareAvailability: seed.shareAvailability,
        userTargetedSharing: seed.userTargetedSharing,
        passwordExtraction: seed.passwordExtraction,
        publicLinks: seed.publicLinks,
        liveTransfer: seed.liveTransfer,
      },
    });
  }

  private async ensureInstanceSetting() {
    return this.prisma.instanceSetting.upsert({
      where: { singletonKey: 'default' },
      update: {},
      create: {
        singletonKey: 'default',
        defaultConfidentialityLevel: DEFAULT_CONFIDENTIALITY_LEVEL,
      },
    });
  }

  private validateBundleSections(input: {
    lifecycle: Record<string, boolean | number | string | null>;
    shareAvailability: Record<string, boolean | number | string | null>;
    userTargetedSharing: Record<string, boolean | number | string | null>;
    passwordExtraction: Record<string, boolean | number | string | null>;
    publicLinks: Record<string, boolean | number | string | null>;
    liveTransfer: Record<string, boolean | number | string | null>;
  }) {
    const lifecycleDefault = this.toNullableNumber(input.lifecycle.defaultValidityMinutes);
    const lifecycleMaximum = this.toNullableNumber(input.lifecycle.maximumValidityMinutes);
    if (
      lifecycleDefault !== null &&
      lifecycleMaximum !== null &&
      lifecycleDefault > lifecycleMaximum
    ) {
      throw new BadRequestException('Lifecycle default validity cannot exceed lifecycle maximum');
    }

    const shareDefault = this.toNullableNumber(input.userTargetedSharing.defaultShareValidityMinutes);
    const shareMaximum = this.toNullableNumber(input.userTargetedSharing.maximumShareValidityMinutes);
    if (shareDefault !== null && shareMaximum !== null && shareDefault > shareMaximum) {
      throw new BadRequestException('Share default validity cannot exceed share maximum');
    }

    if (
      input.shareAvailability.allowUserTargetedSharing === false &&
      shareDefault !== null
    ) {
      throw new BadRequestException('User-targeted share defaults cannot be set when user-targeted sharing is disabled');
    }

    if (
      input.shareAvailability.allowPasswordExtraction === false &&
      this.toNullableNumber(input.passwordExtraction.maximumRetrievalCount) !== null
    ) {
      throw new BadRequestException('Password extraction defaults cannot be set when password extraction is disabled');
    }

    if (
      input.shareAvailability.allowPublicLinks === false &&
      (this.toNullableNumber(input.publicLinks.maximumPublicLinkValidityMinutes) !== null ||
        this.toNullableNumber(input.publicLinks.maximumPublicLinkDownloadCount) !== null)
    ) {
      throw new BadRequestException('Public-link defaults cannot be set when public links are disabled');
    }

    if (
      input.liveTransfer.allowPeerToPeerToRelayFallback === true &&
      input.liveTransfer.allowRelay !== true
    ) {
      throw new BadRequestException('Peer-to-peer-to-relay fallback requires relay to be enabled');
    }
  }

  private toNullableNumber(value: boolean | number | string | null | undefined) {
    if (value === null || value === undefined) {
      return null;
    }

    return Number(value);
  }
}
