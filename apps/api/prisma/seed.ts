import * as argon2 from 'argon2';
import {
  AdmissionState,
  EnablementState,
  UserRole,
} from '../generated/prisma/index.js';
import { createPrismaClient } from '../src/prisma/prisma-client';

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
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
