import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import { stat } from 'fs/promises';
import { resolve } from 'path';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { POLICY_BUNDLE_DEFAULTS } from '../src/policy/policy-defaults';
import { createPrismaClient } from '../src/prisma/prisma-client';

describe('Admin user removal (e2e)', () => {
  let app: INestApplication;
  const prisma = createPrismaClient();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();
  });

  beforeEach(async () => {
    await prisma.trustedDeviceResumeChallenge.deleteMany();
    await prisma.session.deleteMany();
    await prisma.retrievalAttempt.deleteMany();
    await prisma.packageReference.deleteMany();
    await prisma.publicLinkDeliveryTicket.deleteMany();
    await prisma.liveTransferSignalMessage.deleteMany();
    await prisma.liveTransferRelayChunk.deleteMany();
    await prisma.activeTimelineItemProjection.deleteMany();
    await prisma.historyEntryProjection.deleteMany();
    await prisma.searchDocumentProjection.deleteMany();
    await prisma.liveTransferRecordProjection.deleteMany();
    await prisma.liveTransferSession.deleteMany();
    await prisma.accessGrantSet.deleteMany();
    await prisma.packageFamily.deleteMany();
    await prisma.publicLink.deleteMany();
    await prisma.extractionAccess.deleteMany();
    await prisma.shareObject.deleteMany();
    await prisma.groupManifest.deleteMany();
    await prisma.uploadPart.deleteMany();
    await prisma.uploadSession.deleteMany();
    await prisma.sourceItem.deleteMany();
    await prisma.policyBundle.deleteMany();
    await prisma.instanceSetting.deleteMany();
    await prisma.pairingSession.deleteMany();
    await prisma.trustedDevice.deleteMany({
      where: { user: { username: { not: 'owner' } } },
    });
    await prisma.recoveryCredentialSet.deleteMany({
      where: { user: { username: { not: 'owner' } } },
    });
    await prisma.userDomainWrappingKey.deleteMany({
      where: { user: { username: { not: 'owner' } } },
    });
    await prisma.inviteCode.deleteMany();
    await prisma.user.deleteMany({ where: { username: { not: 'owner' } } });

    await prisma.user.update({
      where: { username: 'owner' },
      data: {
        admissionState: 'APPROVED',
        enablementState: 'ENABLED',
        storageQuotaBytes: null,
      },
    });

    for (const seed of POLICY_BUNDLE_DEFAULTS) {
      await prisma.policyBundle.create({
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

    await prisma.instanceSetting.create({
      data: {
        singletonKey: 'default',
        defaultConfidentialityLevel: 'SECRET',
      },
    });
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  async function login(username: string, password: string) {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username, password })
      .expect(200);

    const cookies = response.get('set-cookie');
    expect(cookies).toBeDefined();
    return cookies;
  }

  function mergeCookies(...cookieSets: Array<string[] | undefined>) {
    return cookieSets.flatMap((cookieSet) => cookieSet ?? []);
  }

  async function createApprovedUser(
    username: string,
    password: string,
    adminCookies: string[],
  ) {
    const invite = await request(app.getHttpServer())
      .post('/api/admin/invites')
      .set('Cookie', adminCookies)
      .send({ expiresInMinutes: 60 })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/registration/register')
      .send({ inviteCode: invite.body.code, username, password })
      .expect(201);

    const user = await prisma.user.findUniqueOrThrow({ where: { username } });

    await request(app.getHttpServer())
      .post('/api/admin/users/approve')
      .set('Cookie', adminCookies)
      .send({ userId: user.id })
      .expect(201);

    return user;
  }

  async function bootstrapTrustedUser(
    username: string,
    password: string,
    deviceLabel: string,
    devicePublicIdentity: string,
    userDomainPublicKey: string,
  ) {
    const sessionCookies = await login(username, password);
    const bootstrap = await request(app.getHttpServer())
      .post('/api/trust/bootstrap-first-device')
      .set('Cookie', sessionCookies)
      .send({
        deviceLabel,
        devicePublicIdentity,
        deviceWrappingPublicKey: `${devicePublicIdentity}-wrapping-key`,
        userDomainPublicKey,
      })
      .expect(201);

    return {
      sessionCookies,
      trustedCookies: mergeCookies(sessionCookies, bootstrap.get('set-cookie')),
      trustedDeviceId: bootstrap.body.trustedDeviceId as string,
    };
  }

  async function createStoredFileSource(
    cookies: string[],
    input: { displayName: string; body: Buffer },
  ) {
    const prepare = await request(app.getHttpServer())
      .post('/api/uploads/prepare')
      .set('Cookie', cookies)
      .send({
        contentKind: 'SINGLE_FILE',
        confidentialityLevel: 'SECRET',
        requestedValidityMinutes: 60,
        displayName: input.displayName,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/uploads/${prepare.body.uploadSessionId}/parts/1/blob`)
      .set('Cookie', cookies)
      .set('Content-Type', 'application/octet-stream')
      .send(input.body)
      .expect(201);

    return request(app.getHttpServer())
      .post(`/api/uploads/${prepare.body.uploadSessionId}/finalize`)
      .set('Cookie', cookies)
      .send({ displayName: input.displayName })
      .expect(201);
  }

  function storagePath(storageKey: string) {
    const storageRoot = resolve(
      process.env.STORAGE_ROOT ?? resolve(process.cwd(), '.liminalis-storage'),
    );
    return resolve(storageRoot, storageKey);
  }

  async function expectExistingStorageObject(storageKey: string) {
    await expect(stat(storagePath(storageKey))).resolves.toBeTruthy();
  }

  async function expectMissingStorageObject(storageKey: string) {
    await expect(stat(storagePath(storageKey))).rejects.toThrow();
  }

  it('requires explicit confirmation and protects admin accounts', async () => {
    const adminCookies = await login('owner', 'admin123456');
    const owner = await prisma.user.findUniqueOrThrow({
      where: { username: 'owner' },
    });

    await request(app.getHttpServer())
      .post('/api/admin/users/remove')
      .set('Cookie', adminCookies)
      .send({ userId: owner.id, confirmUsername: 'owner' })
      .expect(400);

    const secondAdmin = await prisma.user.create({
      data: {
        username: 'second-admin',
        passwordHash: await argon2.hash('second-admin-pass'),
        role: 'ADMIN',
        admissionState: 'APPROVED',
        enablementState: 'ENABLED',
      },
    });

    await request(app.getHttpServer())
      .post('/api/admin/users/remove')
      .set('Cookie', adminCookies)
      .send({ userId: secondAdmin.id, confirmUsername: 'second-admin' })
      .expect(403);

    const regularUser = await createApprovedUser(
      'confirm-regular',
      'confirm-pass',
      adminCookies,
    );

    await request(app.getHttpServer())
      .post('/api/admin/users/remove')
      .set('Cookie', adminCookies)
      .send({ userId: regularUser.id, confirmUsername: 'wrong-name' })
      .expect(400);
  });

  it('removes a regular user, their records, and their stored blobs', async () => {
    const adminCookies = await login('owner', 'admin123456');
    const removedUser = await createApprovedUser(
      'remove-regular',
      'remove-pass',
      adminCookies,
    );
    await createApprovedUser('remove-peer', 'remove-peer-pass', adminCookies);

    const ownerBrowser = await bootstrapTrustedUser(
      'remove-regular',
      'remove-pass',
      'Removed Browser',
      'remove-device-1',
      'remove-domain-key',
    );
    const peerBrowser = await bootstrapTrustedUser(
      'remove-peer',
      'remove-peer-pass',
      'Peer Browser',
      'remove-peer-device-1',
      'remove-peer-domain-key',
    );

    const source = await createStoredFileSource(ownerBrowser.trustedCookies, {
      displayName: 'removed-user-file.bin',
      body: Buffer.from('removed user stored bytes'),
    });
    const uploadPart = await prisma.uploadPart.findFirstOrThrow({
      where: {
        uploadSession: { finalizedSourceItemId: source.body.sourceItemId },
      },
    });

    await request(app.getHttpServer())
      .post('/api/public-links')
      .set('Cookie', ownerBrowser.trustedCookies)
      .send({
        sourceItemId: source.body.sourceItemId,
        requestedDownloadCount: 1,
      })
      .expect(201);

    const liveSession = await request(app.getHttpServer())
      .post('/api/live-transfer/sessions')
      .set('Cookie', ownerBrowser.trustedCookies)
      .send({
        contentLabel: 'remove relay file',
        contentKind: 'SINGLE_FILE',
        confidentialityLevel: 'SECRET',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/live-transfer/sessions/join')
      .set('Cookie', peerBrowser.trustedCookies)
      .send({ sessionCode: liveSession.body.sessionCode })
      .expect(201);

    await request(app.getHttpServer())
      .post(
        `/api/live-transfer/sessions/${liveSession.body.liveTransferSessionId}/confirm`,
      )
      .set('Cookie', ownerBrowser.trustedCookies)
      .send({ confirmed: true })
      .expect(201);

    await request(app.getHttpServer())
      .post(
        `/api/live-transfer/sessions/${liveSession.body.liveTransferSessionId}/confirm`,
      )
      .set('Cookie', peerBrowser.trustedCookies)
      .send({ confirmed: true })
      .expect(201);

    await request(app.getHttpServer())
      .post(
        `/api/live-transfer/sessions/${liveSession.body.liveTransferSessionId}/transport`,
      )
      .set('Cookie', ownerBrowser.trustedCookies)
      .send({ transportState: 'RELAY_ATTEMPT' })
      .expect(201);

    await request(app.getHttpServer())
      .post(
        `/api/live-transfer/sessions/${liveSession.body.liveTransferSessionId}/transport`,
      )
      .set('Cookie', peerBrowser.trustedCookies)
      .send({ transportState: 'RELAY_ACTIVE' })
      .expect(201);

    const relayChunk = await request(app.getHttpServer())
      .post(
        `/api/live-transfer/sessions/${liveSession.body.liveTransferSessionId}/relay/chunks/1`,
      )
      .set('Cookie', ownerBrowser.trustedCookies)
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('removed relay chunk'))
      .expect(201);
    const relayRow = await prisma.liveTransferRelayChunk.findUniqueOrThrow({
      where: { id: relayChunk.body.id },
    });

    await expectExistingStorageObject(uploadPart.storageKey);
    await expectExistingStorageObject(relayRow.storageKey);

    await request(app.getHttpServer())
      .post('/api/admin/users/remove')
      .set('Cookie', adminCookies)
      .send({ userId: removedUser.id, confirmUsername: 'remove-regular' })
      .expect(201)
      .expect((response) => {
        expect(response.body.removedUserId).toBe(removedUser.id);
        expect(response.body.username).toBe('remove-regular');
        expect(response.body.storageCleanupFailures).toEqual([]);
        expect(response.body.removedStorageObjects).toBeGreaterThanOrEqual(2);
      });

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'remove-regular', password: 'remove-pass' })
      .expect(401);

    await expectMissingStorageObject(uploadPart.storageKey);
    await expectMissingStorageObject(relayRow.storageKey);
    await expect(
      prisma.user.findUnique({ where: { id: removedUser.id } }),
    ).resolves.toBeNull();
    await expect(
      prisma.sourceItem.count({ where: { ownerUserId: removedUser.id } }),
    ).resolves.toBe(0);
    await expect(
      prisma.trustedDevice.count({ where: { userId: removedUser.id } }),
    ).resolves.toBe(0);
    await expect(
      prisma.liveTransferSession.count({
        where: { initiatorUserId: removedUser.id },
      }),
    ).resolves.toBe(0);

    await request(app.getHttpServer())
      .get('/api/admin/users')
      .set('Cookie', adminCookies)
      .expect(200)
      .expect((response) => {
        expect(
          response.body.some(
            (user: { username?: string }) => user.username === 'remove-regular',
          ),
        ).toBe(false);
        expect(
          response.body.some(
            (user: { username?: string }) => user.username === 'remove-peer',
          ),
        ).toBe(true);
      });

    await request(app.getHttpServer())
      .get('/api/admin/operations/storage/users')
      .set('Cookie', adminCookies)
      .expect(200)
      .expect((response) => {
        expect(
          response.body.some(
            (user: { username?: string }) => user.username === 'remove-regular',
          ),
        ).toBe(false);
      });
  });
});
