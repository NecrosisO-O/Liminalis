import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { stat } from 'fs/promises';
import { resolve } from 'path';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { POLICY_BUNDLE_DEFAULTS } from '../src/policy/policy-defaults';
import { createPrismaClient } from '../src/prisma/prisma-client';

describe('Backend quality gate', () => {
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
    input: {
      displayName: string;
      body?: Buffer;
      requestedDownloadCount?: number;
    },
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
      .send(input.body ?? Buffer.from(`bytes:${input.displayName}`))
      .expect(201);

    return request(app.getHttpServer())
      .post(`/api/uploads/${prepare.body.uploadSessionId}/finalize`)
      .set('Cookie', cookies)
      .send({ displayName: input.displayName })
      .expect(201);
  }

  async function expectMissingStorageObject(storageKey: string) {
    const storageRoot = resolve(
      process.env.STORAGE_ROOT ?? resolve(process.cwd(), '.liminalis-storage'),
    );
    await expect(stat(resolve(storageRoot, storageKey))).rejects.toThrow();
  }

  it('keeps admin mutation responses safe and blocks disabled admins from admin APIs', async () => {
    const adminCookies = await login('owner', 'admin123456');
    const user = await createApprovedUser(
      'admin-safe-user',
      'admin-safe-pass',
      adminCookies,
    );

    await request(app.getHttpServer())
      .post('/api/admin/users/disable')
      .set('Cookie', adminCookies)
      .send({ userId: user.id })
      .expect(201)
      .expect((response) => {
        expect(response.body.username).toBe('admin-safe-user');
        expect(response.body.enablementState).toBe('DISABLED');
        expect(response.body).not.toHaveProperty('passwordHash');
      });

    await request(app.getHttpServer())
      .post('/api/admin/users/enable')
      .set('Cookie', adminCookies)
      .send({ userId: user.id })
      .expect(201)
      .expect((response) => {
        expect(response.body.username).toBe('admin-safe-user');
        expect(response.body.enablementState).toBe('ENABLED');
        expect(response.body).not.toHaveProperty('passwordHash');
      });

    const owner = await prisma.user.findUniqueOrThrow({
      where: { username: 'owner' },
    });
    await request(app.getHttpServer())
      .post('/api/admin/users/disable')
      .set('Cookie', adminCookies)
      .send({ userId: owner.id })
      .expect(201)
      .expect((response) => {
        expect(response.body.username).toBe('owner');
        expect(response.body.enablementState).toBe('DISABLED');
        expect(response.body).not.toHaveProperty('passwordHash');
      });

    await request(app.getHttpServer())
      .get('/api/admin/users')
      .set('Cookie', adminCookies)
      .expect(403);

    await request(app.getHttpServer())
      .get('/api/admin/operations/summary')
      .set('Cookie', adminCookies)
      .expect(403);

    await prisma.user.update({
      where: { id: owner.id },
      data: { enablementState: 'ENABLED' },
    });
  });

  it('removes superseded upload and live relay blobs when replacing the same sequence', async () => {
    const adminCookies = await login('owner', 'admin123456');
    await createApprovedUser(
      'replace-owner',
      'replace-owner-pass',
      adminCookies,
    );
    await createApprovedUser('replace-peer', 'replace-peer-pass', adminCookies);

    const owner = await bootstrapTrustedUser(
      'replace-owner',
      'replace-owner-pass',
      'Replace Owner Browser',
      'replace-owner-device-1',
      'replace-owner-domain-key',
    );
    const peer = await bootstrapTrustedUser(
      'replace-peer',
      'replace-peer-pass',
      'Replace Peer Browser',
      'replace-peer-device-1',
      'replace-peer-domain-key',
    );

    const prepare = await request(app.getHttpServer())
      .post('/api/uploads/prepare')
      .set('Cookie', owner.trustedCookies)
      .send({
        contentKind: 'SINGLE_FILE',
        confidentialityLevel: 'SECRET',
        requestedValidityMinutes: 60,
      })
      .expect(201);

    const firstPart = await request(app.getHttpServer())
      .post(`/api/uploads/${prepare.body.uploadSessionId}/parts/1/blob`)
      .set('Cookie', owner.trustedCookies)
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('first-upload-part'))
      .expect(201);

    const secondPart = await request(app.getHttpServer())
      .post(`/api/uploads/${prepare.body.uploadSessionId}/parts/1/blob`)
      .set('Cookie', owner.trustedCookies)
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('second-upload-part'))
      .expect(201);

    expect(secondPart.body.storageKey).not.toBe(firstPart.body.storageKey);
    await expectMissingStorageObject(firstPart.body.storageKey);

    const liveSession = await request(app.getHttpServer())
      .post('/api/live-transfer/sessions')
      .set('Cookie', owner.trustedCookies)
      .send({
        contentLabel: 'relay replace file',
        contentKind: 'SINGLE_FILE',
        confidentialityLevel: 'SECRET',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/live-transfer/sessions/join')
      .set('Cookie', peer.trustedCookies)
      .send({ sessionCode: liveSession.body.sessionCode })
      .expect(201);

    await request(app.getHttpServer())
      .post(
        `/api/live-transfer/sessions/${liveSession.body.liveTransferSessionId}/confirm`,
      )
      .set('Cookie', owner.trustedCookies)
      .send({ confirmed: true })
      .expect(201);

    await request(app.getHttpServer())
      .post(
        `/api/live-transfer/sessions/${liveSession.body.liveTransferSessionId}/confirm`,
      )
      .set('Cookie', peer.trustedCookies)
      .send({ confirmed: true })
      .expect(201);

    await request(app.getHttpServer())
      .post(
        `/api/live-transfer/sessions/${liveSession.body.liveTransferSessionId}/transport`,
      )
      .set('Cookie', owner.trustedCookies)
      .send({ transportState: 'RELAY_ATTEMPT' })
      .expect(201);

    await request(app.getHttpServer())
      .post(
        `/api/live-transfer/sessions/${liveSession.body.liveTransferSessionId}/transport`,
      )
      .set('Cookie', peer.trustedCookies)
      .send({ transportState: 'RELAY_ACTIVE' })
      .expect(201);

    const firstChunk = await request(app.getHttpServer())
      .post(
        `/api/live-transfer/sessions/${liveSession.body.liveTransferSessionId}/relay/chunks/1`,
      )
      .set('Cookie', owner.trustedCookies)
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('first relay chunk'))
      .expect(201);

    const firstRelayRow = await prisma.liveTransferRelayChunk.findUniqueOrThrow(
      {
        where: { id: firstChunk.body.id },
      },
    );

    const secondChunk = await request(app.getHttpServer())
      .post(
        `/api/live-transfer/sessions/${liveSession.body.liveTransferSessionId}/relay/chunks/1`,
      )
      .set('Cookie', owner.trustedCookies)
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('second relay chunk'))
      .expect(201);

    const secondRelayRow =
      await prisma.liveTransferRelayChunk.findUniqueOrThrow({
        where: { id: secondChunk.body.id },
      });

    expect(secondRelayRow.storageKey).not.toBe(firstRelayRow.storageKey);
    await expectMissingStorageObject(firstRelayRow.storageKey);
  });

  it('uses atomic public-link download consumption under concurrent completions', async () => {
    const adminCookies = await login('owner', 'admin123456');
    await createApprovedUser(
      'public-atomic-owner',
      'public-atomic-pass',
      adminCookies,
    );
    const owner = await bootstrapTrustedUser(
      'public-atomic-owner',
      'public-atomic-pass',
      'Public Atomic Browser',
      'public-atomic-device-1',
      'public-atomic-domain-key',
    );

    const source = await createStoredFileSource(owner.trustedCookies, {
      displayName: 'atomic-public.bin',
      body: Buffer.from('atomic public bytes'),
    });

    const publicLink = await request(app.getHttpServer())
      .post('/api/public-links')
      .set('Cookie', owner.trustedCookies)
      .send({
        sourceItemId: source.body.sourceItemId,
        requestedDownloadCount: 1,
      })
      .expect(201);

    const responses = await Promise.all([
      request(app.getHttpServer()).get(
        `/api/public-links/${publicLink.body.linkToken}`,
      ),
      request(app.getHttpServer()).get(
        `/api/public-links/${publicLink.body.linkToken}`,
      ),
    ]);

    const successfulDownloads = responses.filter(
      (response) => response.status === 200,
    );
    const rejectedDownloads = responses.filter(
      (response) => response.status === 404,
    );

    expect(successfulDownloads).toHaveLength(1);
    expect(rejectedDownloads).toHaveLength(1);

    const publicLinkRow = await prisma.publicLink.findUniqueOrThrow({
      where: { id: publicLink.body.publicLinkId },
    });
    expect(publicLinkRow.remainingDownloadCount).toBe(0);
    expect(publicLinkRow.state).toBe('EXHAUSTED');
  });
});
