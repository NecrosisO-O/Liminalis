import * as argon2 from 'argon2';
import {
  AdmissionState,
  ConfidentialityLevel,
  EnablementState,
  UserRole,
} from '../generated/prisma/index.js';
import { createPrismaClient } from '../src/prisma/prisma-client';
import { POLICY_BUNDLE_DEFAULTS } from '../src/policy/policy-defaults';

const prisma = createPrismaClient();

async function main() {
  const adminPasswordHash = await argon2.hash('admin123456');

  await prisma.user.upsert({
    where: { username: 'owner' },
    update: {
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
      admissionState: AdmissionState.APPROVED,
      enablementState: EnablementState.ENABLED,
    },
    create: {
      username: 'owner',
      email: 'owner@liminalis.local',
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
      admissionState: AdmissionState.APPROVED,
      enablementState: EnablementState.ENABLED,
      approvedAt: new Date(),
    },
  });

  for (const policyBundle of POLICY_BUNDLE_DEFAULTS) {
    await prisma.policyBundle.upsert({
      where: {
        levelName_bundleVersion: {
          levelName: policyBundle.levelName,
          bundleVersion: 1,
        },
      },
      update: {
        isCurrent: true,
        lifecycle: policyBundle.lifecycle,
        shareAvailability: policyBundle.shareAvailability,
        userTargetedSharing: policyBundle.userTargetedSharing,
        passwordExtraction: policyBundle.passwordExtraction,
        publicLinks: policyBundle.publicLinks,
        liveTransfer: policyBundle.liveTransfer,
      },
      create: {
        levelName: policyBundle.levelName,
        bundleVersion: 1,
        isCurrent: true,
        lifecycle: policyBundle.lifecycle,
        shareAvailability: policyBundle.shareAvailability,
        userTargetedSharing: policyBundle.userTargetedSharing,
        passwordExtraction: policyBundle.passwordExtraction,
        publicLinks: policyBundle.publicLinks,
        liveTransfer: policyBundle.liveTransfer,
      },
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
