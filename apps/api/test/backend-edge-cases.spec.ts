import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { POLICY_BUNDLE_DEFAULTS } from '../src/policy/policy-defaults';
import { createPrismaClient } from '../src/prisma/prisma-client';

describe('Backend edge-case coverage', () => {
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

  async function createStoredFileSource(
    cookies: string[],
    input: {
      displayName: string;
      confidentialityLevel?: 'SECRET' | 'CONFIDENTIAL' | 'TOP_SECRET';
      requestedValidityMinutes?: number;
      body?: Buffer;
    },
  ) {
    const prepare = await request(app.getHttpServer())
      .post('/api/uploads/prepare')
      .set('Cookie', cookies)
      .send({
        contentKind: 'SINGLE_FILE',
        confidentialityLevel: input.confidentialityLevel ?? 'SECRET',
        requestedValidityMinutes: input.requestedValidityMinutes ?? 60,
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
      bootstrap,
    };
  }

  it('rejects expired, consumed, and invalidated invites', async () => {
    const adminCookies = await login('owner', 'admin123456');

    const expiredInvite = await request(app.getHttpServer())
      .post('/api/admin/invites')
      .set('Cookie', adminCookies)
      .send({ expiresInMinutes: 5 })
      .expect(201);
    await prisma.inviteCode.update({
      where: { id: expiredInvite.body.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await request(app.getHttpServer())
      .post('/api/registration/register')
      .send({
        inviteCode: expiredInvite.body.code,
        username: 'expired-user',
        password: 'expired-pass',
      })
      .expect(400);

    const consumedInvite = await request(app.getHttpServer())
      .post('/api/admin/invites')
      .set('Cookie', adminCookies)
      .send({ expiresInMinutes: 60 })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/registration/register')
      .send({
        inviteCode: consumedInvite.body.code,
        username: 'consumed-user',
        password: 'consumed-pass',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/registration/register')
      .send({
        inviteCode: consumedInvite.body.code,
        username: 'consumed-user-2',
        password: 'consumed-pass-2',
      })
      .expect(400);

    const invalidatedInvite = await request(app.getHttpServer())
      .post('/api/admin/invites')
      .set('Cookie', adminCookies)
      .send({ expiresInMinutes: 60 })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/admin/invites/invalidate')
      .set('Cookie', adminCookies)
      .send({ inviteId: invalidatedInvite.body.id })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/registration/register')
      .send({
        inviteCode: invalidatedInvite.body.code,
        username: 'invalidated-user',
        password: 'invalidated-pass',
      })
      .expect(400);
  });

  it('rejects expired and logged-out sessions when reused', async () => {
    const adminCookies = await login('owner', 'admin123456');
    const user = await createApprovedUser(
      'session-user',
      'session-password',
      adminCookies,
    );
    const sessionCookies = await login('session-user', 'session-password');

    const sessionToken = sessionCookies
      .find((cookie) => cookie.startsWith('liminalis_session='))
      ?.split(';')[0]
      .split('=')[1];
    expect(sessionToken).toBeTruthy();

    await prisma.session.updateMany({
      where: { userId: user.id, token: sessionToken },
      data: { idleExpiresAt: new Date(Date.now() - 1000) },
    });

    await request(app.getHttpServer())
      .get('/api/bootstrap')
      .set('Cookie', sessionCookies)
      .expect(401);

    const freshCookies = await login('session-user', 'session-password');
    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', freshCookies)
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/bootstrap')
      .set('Cookie', freshCookies)
      .expect(401);
  });

  it('allows repeat-download share retrieval across multiple completions', async () => {
    const adminCookies = await login('owner', 'admin123456');
    await createApprovedUser(
      'repeat-sender',
      'repeat-sender-pass',
      adminCookies,
    );
    await createApprovedUser(
      'repeat-recipient',
      'repeat-recipient-pass',
      adminCookies,
    );

    const sender = await bootstrapTrustedUser(
      'repeat-sender',
      'repeat-sender-pass',
      'Repeat Sender Browser',
      'repeat-sender-device-1',
      'repeat-sender-domain-key',
    );
    const recipient = await bootstrapTrustedUser(
      'repeat-recipient',
      'repeat-recipient-pass',
      'Repeat Recipient Browser',
      'repeat-recipient-device-1',
      'repeat-recipient-domain-key',
    );

    const finalize = await createStoredFileSource(sender.trustedCookies, {
      displayName: 'repeat.bin',
      confidentialityLevel: 'SECRET',
      requestedValidityMinutes: 60,
    });

    const share = await request(app.getHttpServer())
      .post('/api/shares')
      .set('Cookie', sender.trustedCookies)
      .send({
        sourceItemId: finalize.body.sourceItemId,
        recipientUsername: 'repeat-recipient',
        requestedValidityMinutes: 30,
      })
      .expect(201);
    expect(share.body.allowRepeatDownload).toBe(true);

    const firstAttempt = await request(app.getHttpServer())
      .post(`/api/shares/${share.body.shareObjectId}/attempts/repeat-1`)
      .set('Cookie', recipient.trustedCookies)
      .expect(201);
    await request(app.getHttpServer())
      .post(
        `/api/retrieval/attempts/${firstAttempt.body.retrievalAttemptId}/complete`,
      )
      .set('Cookie', recipient.trustedCookies)
      .send({ success: true })
      .expect(201);

    const secondAttempt = await request(app.getHttpServer())
      .post(`/api/shares/${share.body.shareObjectId}/attempts/repeat-2`)
      .set('Cookie', recipient.trustedCookies)
      .expect(201);
    await request(app.getHttpServer())
      .post(
        `/api/retrieval/attempts/${secondAttempt.body.retrievalAttemptId}/complete`,
      )
      .set('Cookie', recipient.trustedCookies)
      .send({ success: true })
      .expect(201);

    const shareRow = await prisma.shareObject.findUniqueOrThrow({
      where: { id: share.body.shareObjectId },
    });
    expect(shareRow.state).toBe('ACTIVE');
    expect(shareRow.inactiveReason).toBeNull();
  });

  it('rejects expired and replayed public-link tickets', async () => {
    const adminCookies = await login('owner', 'admin123456');
    await createApprovedUser('link-sender', 'link-sender-pass', adminCookies);
    await createApprovedUser(
      'link-recipient',
      'link-recipient-pass',
      adminCookies,
    );

    const sender = await bootstrapTrustedUser(
      'link-sender',
      'link-sender-pass',
      'Link Sender Browser',
      'link-sender-device-1',
      'link-sender-domain-key',
    );
    const recipient = await bootstrapTrustedUser(
      'link-recipient',
      'link-recipient-pass',
      'Link Recipient Browser',
      'link-recipient-device-1',
      'link-recipient-domain-key',
    );

    const finalize = await createStoredFileSource(sender.trustedCookies, {
      displayName: 'public.bin',
      confidentialityLevel: 'SECRET',
      requestedValidityMinutes: 60,
    });
    const share = await request(app.getHttpServer())
      .post('/api/shares')
      .set('Cookie', sender.trustedCookies)
      .send({
        sourceItemId: finalize.body.sourceItemId,
        recipientUsername: 'link-recipient',
        requestedValidityMinutes: 30,
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/shares/${share.body.shareObjectId}/attempts/link-share-1`)
      .set('Cookie', recipient.trustedCookies)
      .expect(201);

    const publicLink = await request(app.getHttpServer())
      .post('/api/public-links')
      .set('Cookie', sender.trustedCookies)
      .send({
        sourceItemId: finalize.body.sourceItemId,
        requestedValidityMinutes: 30,
        requestedDownloadCount: 2,
      })
      .expect(201);

    const expiredTicket = await request(app.getHttpServer())
      .post(`/api/public-links/${publicLink.body.linkToken}/tickets`)
      .expect(201);
    await prisma.publicLinkDeliveryTicket.update({
      where: { ticketToken: expiredTicket.body.ticketToken },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await request(app.getHttpServer())
      .post(
        `/api/public-links/tickets/${expiredTicket.body.ticketToken}/redeem`,
      )
      .expect(404);

    const freshTicket = await request(app.getHttpServer())
      .post(`/api/public-links/${publicLink.body.linkToken}/tickets`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/public-links/tickets/${freshTicket.body.ticketToken}/redeem`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/public-links/tickets/${freshTicket.body.ticketToken}/redeem`)
      .expect(404);

    const publicLinkRow = await prisma.publicLink.findUniqueOrThrow({
      where: { id: publicLink.body.publicLinkId },
    });
    expect(publicLinkRow.remainingDownloadCount).toBe(1);
    expect(publicLinkRow.state).toBe('ACTIVE');
  });

  it('supports explicit share-object regrant after a new trusted device is paired', async () => {
    const adminCookies = await login('owner', 'admin123456');
    await createApprovedUser('share-owner', 'share-owner-pass', adminCookies);
    const recipientUser = await createApprovedUser(
      'share-recipient',
      'share-recipient-pass',
      adminCookies,
    );

    const owner = await bootstrapTrustedUser(
      'share-owner',
      'share-owner-pass',
      'Share Owner Browser',
      'share-owner-device-1',
      'share-owner-domain-key',
    );
    const recipient = await bootstrapTrustedUser(
      'share-recipient',
      'share-recipient-pass',
      'Share Recipient Browser 1',
      'share-recipient-device-1',
      'share-recipient-domain-key',
    );

    await prisma.policyBundle.updateMany({
      where: { levelName: 'SECRET', isCurrent: true },
      data: {
        userTargetedSharing: {
          defaultShareValidityMinutes: 60,
          maximumShareValidityMinutes: null,
          allowRepeatDownload: true,
          allowRecipientMultiDeviceAccess: false,
        },
      },
    });

    const finalize = await createStoredFileSource(owner.trustedCookies, {
      displayName: 'share-snapshot.bin',
      confidentialityLevel: 'SECRET',
      requestedValidityMinutes: 60,
    });

    const share = await request(app.getHttpServer())
      .post('/api/shares')
      .set('Cookie', owner.trustedCookies)
      .send({
        sourceItemId: finalize.body.sourceItemId,
        recipientUsername: 'share-recipient',
        requestedValidityMinutes: 30,
      })
      .expect(201);
    expect(share.body.allowRecipientMultiDeviceAccess).toBe(false);

    const pairing = await request(app.getHttpServer())
      .post('/api/trust/pairing-sessions')
      .set('Cookie', recipient.trustedCookies)
      .send({
        deviceLabel: 'Share Recipient Browser 2',
        devicePublicIdentity: 'share-recipient-device-2',
        deviceWrappingPublicKey: 'share-recipient-device-2-wrapping-key',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/trust/pairing/approve')
      .set('Cookie', recipient.trustedCookies)
      .send({
        pairingSessionId: pairing.body.id,
        approvalPackage: {
          encryptedUserDomainPrivateKey: 'share-recipient-device-2-package',
        },
      })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/trust/pairing/finalize')
      .set('Cookie', recipient.sessionCookies)
      .send({ pairingSessionId: pairing.body.id })
      .expect(201);

    const secondRecipientDevice = await prisma.trustedDevice.findFirstOrThrow({
      where: {
        userId: recipientUser.id,
        publicIdentityPayload: 'share-recipient-device-2',
      },
    });
    const secondRecipientCookies = [
      ...recipient.sessionCookies,
      `liminalis_trusted_device=${secondRecipientDevice.id}`,
    ];

    await request(app.getHttpServer())
      .post(
        `/api/shares/${share.body.shareObjectId}/attempts/share-before-regrant`,
      )
      .set('Cookie', secondRecipientCookies)
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/maintenance/regrant')
      .set('Cookie', recipient.trustedCookies)
      .send({
        protectedObjectType: 'SHARE_OBJECT',
        protectedObjectId: share.body.shareObjectId,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(
        `/api/shares/${share.body.shareObjectId}/attempts/share-after-regrant`,
      )
      .set('Cookie', secondRecipientCookies)
      .expect(201);

    const grantSets = await prisma.accessGrantSet.findMany({
      where: { shareObjectId: share.body.shareObjectId },
      orderBy: { version: 'asc' },
    });
    expect(grantSets).toHaveLength(2);
    expect(grantSets[0].status).toBe('SUPERSEDED');
    expect(grantSets[1].status).toBe('CURRENT');
    expect(grantSets[1].snapshotDeviceIds).toContain(secondRecipientDevice.id);
  });

  it('keeps admin user projections safe and enforces per-user storage quotas', async () => {
    const adminCookies = await login('owner', 'admin123456');
    const user = await createApprovedUser(
      'quota-user',
      'quota-user-pass',
      adminCookies,
    );
    const trustedUser = await bootstrapTrustedUser(
      'quota-user',
      'quota-user-pass',
      'Quota User Browser',
      'quota-user-device-1',
      'quota-user-domain-key',
    );

    await request(app.getHttpServer())
      .post('/api/admin/operations/storage/quota')
      .set('Cookie', adminCookies)
      .send({ userId: user.id, quotaBytes: 8 })
      .expect(201)
      .expect((response) => {
        expect(response.body.storageQuotaBytes).toBe(8);
      });

    const users = await request(app.getHttpServer())
      .get('/api/admin/users')
      .set('Cookie', adminCookies)
      .expect(200);
    const quotaUser = users.body.find(
      (row: { username?: string }) => row.username === 'quota-user',
    );
    expect(quotaUser).toBeTruthy();
    expect(quotaUser).not.toHaveProperty('passwordHash');

    const prepare = await request(app.getHttpServer())
      .post('/api/uploads/prepare')
      .set('Cookie', trustedUser.trustedCookies)
      .send({
        contentKind: 'SINGLE_FILE',
        confidentialityLevel: 'SECRET',
        requestedValidityMinutes: 30,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/uploads/${prepare.body.uploadSessionId}/parts/1/blob`)
      .set('Cookie', trustedUser.trustedCookies)
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('123456789'))
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/uploads/${prepare.body.uploadSessionId}/parts/1/blob`)
      .set('Cookie', trustedUser.trustedCookies)
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('12345678'))
      .expect(201);

    const storageUsers = await request(app.getHttpServer())
      .get('/api/admin/operations/storage/users')
      .set('Cookie', adminCookies)
      .expect(200);
    const quotaStorage = storageUsers.body.find(
      (row: { username?: string }) => row.username === 'quota-user',
    );
    expect(quotaStorage.storageUsedBytes).toBe(8);
    expect(quotaStorage.storageQuotaBytes).toBe(8);
    expect(quotaStorage.hasCustomQuota).toBe(true);
  });

  it('cascades source revocation and top-secret upgrades to shares, extractions, public links, and open retrieval attempts', async () => {
    const adminCookies = await login('owner', 'admin123456');
    await createApprovedUser(
      'cascade-owner',
      'cascade-owner-pass',
      adminCookies,
    );
    await createApprovedUser(
      'cascade-recipient',
      'cascade-recipient-pass',
      adminCookies,
    );

    const owner = await bootstrapTrustedUser(
      'cascade-owner',
      'cascade-owner-pass',
      'Cascade Owner Browser',
      'cascade-owner-device-1',
      'cascade-owner-domain-key',
    );
    const recipient = await bootstrapTrustedUser(
      'cascade-recipient',
      'cascade-recipient-pass',
      'Cascade Recipient Browser',
      'cascade-recipient-device-1',
      'cascade-recipient-domain-key',
    );

    const revokedSource = await createStoredFileSource(owner.trustedCookies, {
      displayName: 'revoked.bin',
      confidentialityLevel: 'SECRET',
      requestedValidityMinutes: 60,
    });
    const revokedShare = await request(app.getHttpServer())
      .post('/api/shares')
      .set('Cookie', owner.trustedCookies)
      .send({
        sourceItemId: revokedSource.body.sourceItemId,
        recipientUsername: 'cascade-recipient',
        requestedValidityMinutes: 30,
      })
      .expect(201);
    const revokedExtraction = await request(app.getHttpServer())
      .post('/api/extraction')
      .set('Cookie', owner.trustedCookies)
      .send({
        sourceItemId: revokedSource.body.sourceItemId,
        password: 'cascade-password',
        requestedRetrievalCount: 1,
      })
      .expect(201);
    const revokedPublicLink = await request(app.getHttpServer())
      .post('/api/public-links')
      .set('Cookie', owner.trustedCookies)
      .send({
        sourceItemId: revokedSource.body.sourceItemId,
        requestedDownloadCount: 1,
      })
      .expect(201);
    const shareAttempt = await request(app.getHttpServer())
      .post(
        `/api/shares/${revokedShare.body.shareObjectId}/attempts/cascade-open-share`,
      )
      .set('Cookie', recipient.trustedCookies)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/source-items/${revokedSource.body.sourceItemId}/revoke`)
      .set('Cookie', owner.trustedCookies)
      .expect(201)
      .expect((response) => {
        expect(response.body.state).toBe('INVALIDATED');
      });

    const [
      shareAfterRevoke,
      extractionAfterRevoke,
      publicLinkAfterRevoke,
      attemptAfterRevoke,
    ] = await Promise.all([
      prisma.shareObject.findUniqueOrThrow({
        where: { id: revokedShare.body.shareObjectId },
      }),
      prisma.extractionAccess.findUniqueOrThrow({
        where: { id: revokedExtraction.body.extractionAccessId },
      }),
      prisma.publicLink.findUniqueOrThrow({
        where: { id: revokedPublicLink.body.publicLinkId },
      }),
      prisma.retrievalAttempt.findUniqueOrThrow({
        where: { id: shareAttempt.body.retrievalAttemptId },
      }),
    ]);

    expect(shareAfterRevoke.state).toBe('INACTIVE');
    expect(shareAfterRevoke.inactiveReason).toBe('SOURCE_INVALIDATED');
    expect(extractionAfterRevoke.state).toBe('INVALIDATED');
    expect(publicLinkAfterRevoke.state).toBe('INVALIDATED');
    expect(attemptAfterRevoke.status).toBe('ABANDONED');

    await request(app.getHttpServer())
      .post(
        `/api/shares/${revokedShare.body.shareObjectId}/attempts/cascade-after-revoke`,
      )
      .set('Cookie', recipient.trustedCookies)
      .expect(400);
    await request(app.getHttpServer())
      .post(
        `/api/extraction/${revokedExtraction.body.entryToken}/attempts/cascade-after-revoke`,
      )
      .send({ password: 'cascade-password' })
      .expect(400);
    await request(app.getHttpServer())
      .get(`/api/public-links/${revokedPublicLink.body.linkToken}`)
      .expect(404);

    const upgradedSource = await createStoredFileSource(owner.trustedCookies, {
      displayName: 'upgraded.bin',
      confidentialityLevel: 'SECRET',
      requestedValidityMinutes: 60,
    });
    const upgradedShare = await request(app.getHttpServer())
      .post('/api/shares')
      .set('Cookie', owner.trustedCookies)
      .send({
        sourceItemId: upgradedSource.body.sourceItemId,
        recipientUsername: 'cascade-recipient',
        requestedValidityMinutes: 30,
      })
      .expect(201);
    const upgradedExtraction = await request(app.getHttpServer())
      .post('/api/extraction')
      .set('Cookie', owner.trustedCookies)
      .send({
        sourceItemId: upgradedSource.body.sourceItemId,
        password: 'cascade-password',
        requestedRetrievalCount: 1,
      })
      .expect(201);
    const upgradedPublicLink = await request(app.getHttpServer())
      .post('/api/public-links')
      .set('Cookie', owner.trustedCookies)
      .send({
        sourceItemId: upgradedSource.body.sourceItemId,
        requestedDownloadCount: 1,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(
        `/api/source-items/${upgradedSource.body.sourceItemId}/confidentiality`,
      )
      .set('Cookie', owner.trustedCookies)
      .send({ confidentialityLevel: 'TOP_SECRET' })
      .expect(201)
      .expect((response) => {
        expect(response.body.confidentialityLevel).toBe('TOP_SECRET');
      });

    const [shareAfterUpgrade, extractionAfterUpgrade, publicLinkAfterUpgrade] =
      await Promise.all([
        prisma.shareObject.findUniqueOrThrow({
          where: { id: upgradedShare.body.shareObjectId },
        }),
        prisma.extractionAccess.findUniqueOrThrow({
          where: { id: upgradedExtraction.body.extractionAccessId },
        }),
        prisma.publicLink.findUniqueOrThrow({
          where: { id: upgradedPublicLink.body.publicLinkId },
        }),
      ]);

    expect(shareAfterUpgrade.state).toBe('INACTIVE');
    expect(shareAfterUpgrade.inactiveReason).toBe('SOURCE_INVALIDATED');
    expect(extractionAfterUpgrade.state).toBe('INVALIDATED');
    expect(publicLinkAfterUpgrade.state).toBe('INVALIDATED');
  });

  it('supports live-transfer cancel branch and stored fallback after cancellation when policy allows it', async () => {
    const adminCookies = await login('owner', 'admin123456');
    await createApprovedUser('live-owner', 'live-owner-pass', adminCookies);
    await createApprovedUser(
      'live-recipient',
      'live-recipient-pass',
      adminCookies,
    );

    const owner = await bootstrapTrustedUser(
      'live-owner',
      'live-owner-pass',
      'Live Owner Browser',
      'live-owner-device-1',
      'live-owner-domain-key',
    );
    const recipient = await bootstrapTrustedUser(
      'live-recipient',
      'live-recipient-pass',
      'Live Recipient Browser',
      'live-recipient-device-1',
      'live-recipient-domain-key',
    );

    const liveSession = await request(app.getHttpServer())
      .post('/api/live-transfer/sessions')
      .set('Cookie', owner.trustedCookies)
      .send({
        contentLabel: 'cancelled live file',
        contentKind: 'SINGLE_FILE',
        confidentialityLevel: 'SECRET',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/live-transfer/sessions/join')
      .set('Cookie', recipient.trustedCookies)
      .send({ sessionCode: liveSession.body.sessionCode })
      .expect(201);

    await request(app.getHttpServer())
      .post(
        `/api/live-transfer/sessions/${liveSession.body.liveTransferSessionId}/confirm`,
      )
      .set('Cookie', owner.trustedCookies)
      .send({ confirmed: false })
      .expect(201)
      .expect((response) => {
        expect(response.body.state).toBe('CANCELLED');
      });

    await request(app.getHttpServer())
      .post(
        `/api/live-transfer/sessions/${liveSession.body.liveTransferSessionId}/stored-fallback`,
      )
      .set('Cookie', owner.trustedCookies)
      .expect(201)
      .expect((response) => {
        expect(response.body.uploadSessionId).toBeTruthy();
        expect(response.body.contentLabel).toBe('cancelled live file');
      });

    const records = await request(app.getHttpServer())
      .get('/api/live-transfer/records')
      .set('Cookie', owner.trustedCookies)
      .expect(200);
    expect(
      records.body.some(
        (row: { sessionOutcome?: string }) =>
          row.sessionOutcome === 'cancelled',
      ),
    ).toBe(true);
  });
});
