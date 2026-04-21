import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import {
  ConfidentialityLevel,
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
    for (const seed of POLICY_BUNDLE_DEFAULTS) {
      await this.ensureCurrentBundle(seed);
    }
  }

  getDefaultConfidentialityLevel() {
    return DEFAULT_CONFIDENTIALITY_LEVEL;
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

  private toNullableNumber(value: boolean | number | string | null | undefined) {
    if (value === null || value === undefined) {
      return null;
    }

    return Number(value);
  }
}
