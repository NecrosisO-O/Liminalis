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
