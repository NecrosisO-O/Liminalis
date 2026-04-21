import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { POLICY_BUNDLE_DEFAULTS } from '../src/policy/policy-defaults';
import { createPrismaClient } from '../src/prisma/prisma-client';

describe('Manual integration coverage', () => {
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
    await prisma.trustedDevice.deleteMany({ where: { user: { username: { not: 'owner' } } } });
    await prisma.recoveryCredentialSet.deleteMany({ where: { user: { username: { not: 'owner' } } } });
    await prisma.userDomainWrappingKey.deleteMany({ where: { user: { username: { not: 'owner' } } } });
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

  async function createApprovedUser(username: string, password: string, adminCookies: string[]) {
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
      .send({ deviceLabel, devicePublicIdentity, userDomainPublicKey })
      .expect(201);

    return {
      sessionCookies,
      trustedCookies: mergeCookies(sessionCookies, bootstrap.get('set-cookie')),
      bootstrap,
    };
  }

  it('covers identity, trust, recovery, upload, self retrieval, and snapshot pre-regrant blocking', async () => {
    const adminCookies = await login('owner', 'admin123456');
    const ivy = await createApprovedUser('ivy', 'ivy-password', adminCookies);

    const ivySessionCookies = await login('ivy', 'ivy-password');
    const bootstrap = await request(app.getHttpServer())
      .get('/api/bootstrap')
      .set('Cookie', ivySessionCookies)
      .expect(200);
    expect(bootstrap.body.requiresFirstDeviceBootstrap).toBe(true);

    const ivyTrust = await bootstrapTrustedUser(
      'ivy',
      'ivy-password',
      'Ivy Browser 1',
      'ivy-device-1',
      'ivy-domain-key',
    );
    expect(ivyTrust.bootstrap.body.recoveryCodes).toHaveLength(3);

    const recovery = await request(app.getHttpServer())
      .post('/api/recovery/attempt')
      .set('Cookie', ivySessionCookies)
      .send({
        recoveryCode: ivyTrust.bootstrap.body.recoveryCodes[0],
        deviceLabel: 'Ivy Recovery Browser',
        devicePublicIdentity: 'ivy-recovery-device',
      })
      .expect(201);

    const pendingDisplay = await request(app.getHttpServer())
      .get('/api/recovery/pending-display')
      .set('Cookie', ivySessionCookies)
      .expect(200);
    expect(pendingDisplay.body.recoveryCodes).toEqual(recovery.body.recoveryCodes);

    await request(app.getHttpServer())
      .post(`/api/recovery/acknowledge/${recovery.body.pendingTrustedDeviceId}`)
      .set('Cookie', ivySessionCookies)
      .expect(201);

    const prepare = await request(app.getHttpServer())
      .post('/api/uploads/prepare')
      .set('Cookie', ivyTrust.trustedCookies)
      .send({ contentKind: 'SELF_SPACE_TEXT', confidentialityLevel: 'SECRET', requestedValidityMinutes: 30 })
      .expect(201);

    const finalize = await request(app.getHttpServer())
      .post(`/api/uploads/${prepare.body.uploadSessionId}/finalize`)
      .set('Cookie', ivyTrust.trustedCookies)
      .send({ displayName: 'ivy note', textCiphertextBody: 'ciphertext ivy body' })
      .expect(201);

    const retrieval = await request(app.getHttpServer())
      .post(`/api/retrieval/source-items/${finalize.body.sourceItemId}/attempts/ivy-self-1`)
      .set('Cookie', ivyTrust.trustedCookies)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/retrieval/attempts/${retrieval.body.retrievalAttemptId}/complete`)
      .set('Cookie', ivyTrust.trustedCookies)
      .send({ success: true })
      .expect(201);

    const topSecretPrepare = await request(app.getHttpServer())
      .post('/api/uploads/prepare')
      .set('Cookie', ivyTrust.trustedCookies)
      .send({ contentKind: 'SELF_SPACE_TEXT', confidentialityLevel: 'TOP_SECRET', requestedValidityMinutes: 30 })
      .expect(201);

    const topSecretFinalize = await request(app.getHttpServer())
      .post(`/api/uploads/${topSecretPrepare.body.uploadSessionId}/finalize`)
      .set('Cookie', ivyTrust.trustedCookies)
      .send({ displayName: 'snapshot item', textCiphertextBody: 'ciphertext top secret body' })
      .expect(201);

    const pairing = await request(app.getHttpServer())
      .post('/api/trust/pairing-sessions')
      .set('Cookie', ivyTrust.trustedCookies)
      .send({ deviceLabel: 'Ivy Browser 2', devicePublicIdentity: 'ivy-device-2' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/trust/pairing/approve')
      .set('Cookie', ivyTrust.trustedCookies)
      .send({ pairingSessionId: pairing.body.id })
      .expect(201);

    const secondDevice = await prisma.trustedDevice.findFirstOrThrow({
      where: { userId: ivy.id, publicIdentityPayload: 'ivy-device-2' },
    });
    const secondDeviceCookies = [...ivyTrust.sessionCookies, `liminalis_trusted_device=${secondDevice.id}`];

    await request(app.getHttpServer())
      .post(`/api/retrieval/source-items/${topSecretFinalize.body.sourceItemId}/attempts/ivy-second-before-regrant`)
      .set('Cookie', secondDeviceCookies)
      .expect(403);
  });

  it('covers projection, sharing, extraction, public link, and counter persistence', async () => {
    const adminCookies = await login('owner', 'admin123456');
    await createApprovedUser('june', 'june-password', adminCookies);
    await createApprovedUser('kian', 'kian-password', adminCookies);

    const juneTrust = await bootstrapTrustedUser(
      'june',
      'june-password',
      'June Browser 1',
      'june-device-1',
      'june-domain-key',
    );
    const kianTrust = await bootstrapTrustedUser(
      'kian',
      'kian-password',
      'Kian Browser 1',
      'kian-device-1',
      'kian-domain-key',
    );

    const groupedPrepare = await request(app.getHttpServer())
      .post('/api/uploads/prepare')
      .set('Cookie', juneTrust.trustedCookies)
      .send({
        contentKind: 'GROUPED_CONTENT',
        groupStructureKind: 'MULTI_FILE',
        confidentialityLevel: 'SECRET',
        requestedValidityMinutes: 45,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/uploads/${groupedPrepare.body.uploadSessionId}/parts`)
      .set('Cookie', juneTrust.trustedCookies)
      .send({ partNumber: 1, byteSize: 1024, storageKey: 'group/part-1' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/uploads/${groupedPrepare.body.uploadSessionId}/finalize`)
      .set('Cookie', juneTrust.trustedCookies)
      .send({
        displayName: 'group folder',
        manifest: {
          items: [
            { path: 'alpha.txt', byteSize: 512, contentType: 'text/plain' },
            { path: 'beta.txt', byteSize: 512, contentType: 'text/plain' },
          ],
        },
      })
      .expect(201);

    const timeline = await request(app.getHttpServer())
      .get('/api/timeline')
      .set('Cookie', juneTrust.trustedCookies)
      .expect(200);
    expect(timeline.body.length).toBeGreaterThanOrEqual(1);

    const search = await request(app.getHttpServer())
      .get('/api/search')
      .query({ q: 'group folder' })
      .set('Cookie', juneTrust.trustedCookies)
      .expect(200);
    expect(search.body.some((item: { displayTitle?: string }) => item.displayTitle === 'group folder')).toBe(true);

    const textPrepare = await request(app.getHttpServer())
      .post('/api/uploads/prepare')
      .set('Cookie', juneTrust.trustedCookies)
      .send({ contentKind: 'SELF_SPACE_TEXT', confidentialityLevel: 'SECRET', requestedValidityMinutes: 60 })
      .expect(201);

    const textFinalize = await request(app.getHttpServer())
      .post(`/api/uploads/${textPrepare.body.uploadSessionId}/finalize`)
      .set('Cookie', juneTrust.trustedCookies)
      .send({ displayName: 'shareable note', textCiphertextBody: 'ciphertext for shareable note' })
      .expect(201);

    const share = await request(app.getHttpServer())
      .post('/api/shares')
      .set('Cookie', juneTrust.trustedCookies)
      .send({ sourceItemId: textFinalize.body.sourceItemId, recipientUsername: 'kian', requestedValidityMinutes: 30 })
      .expect(201);

    const recipientAttempt = await request(app.getHttpServer())
      .post(`/api/shares/${share.body.shareObjectId}/attempts/kian-share-1`)
      .set('Cookie', kianTrust.trustedCookies)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/retrieval/attempts/${recipientAttempt.body.retrievalAttemptId}/complete`)
      .set('Cookie', kianTrust.trustedCookies)
      .send({ success: true })
      .expect(201);

    const extraction = await request(app.getHttpServer())
      .post('/api/extraction')
      .set('Cookie', juneTrust.trustedCookies)
      .send({ shareObjectId: share.body.shareObjectId, password: 'manual-pass-123', requestedRetrievalCount: 2 })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/extraction/${extraction.body.entryToken}/attempts/extraction-bad-1`)
      .send({ password: 'wrong-pass' })
      .expect(403);

    const extractionEntry = await request(app.getHttpServer())
      .get(`/api/extraction/${extraction.body.entryToken}`)
      .expect(200);
    expect(extractionEntry.body.state).toBe('CHALLENGE_REQUIRED');

    const extractionAttempt = await request(app.getHttpServer())
      .post(`/api/extraction/${extraction.body.entryToken}/attempts/extraction-good-1`)
      .send({ password: 'manual-pass-123', captchaSatisfied: true })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/extraction/attempts/${extractionAttempt.body.retrievalAttemptId}/complete`)
      .send({ success: true })
      .expect(201);

    const publicLink = await request(app.getHttpServer())
      .post('/api/public-links')
      .set('Cookie', juneTrust.trustedCookies)
      .send({ shareObjectId: share.body.shareObjectId, requestedDownloadCount: 2, requestedValidityMinutes: 30 })
      .expect(201);

    const ticket = await request(app.getHttpServer())
      .post(`/api/public-links/${publicLink.body.linkToken}/tickets`)
      .expect(201);

    const redeemed = await request(app.getHttpServer())
      .post(`/api/public-links/tickets/${ticket.body.ticketToken}/redeem`)
      .expect(201);
    expect(redeemed.body.remainingDownloadCount).toBe(1);

    const history = await request(app.getHttpServer())
      .get('/api/history')
      .set('Cookie', kianTrust.trustedCookies)
      .expect(200);
    expect(history.body.length).toBeGreaterThanOrEqual(1);

    const extractionRows = await prisma.extractionAccess.findMany({ where: { shareObjectId: share.body.shareObjectId } });
    expect(extractionRows).toHaveLength(1);
    expect(extractionRows[0].remainingRetrievalCount).toBe(1);

    const publicLinkRows = await prisma.publicLink.findMany({ where: { shareObjectId: share.body.shareObjectId } });
    expect(publicLinkRows).toHaveLength(1);
    expect(publicLinkRows[0].remainingDownloadCount).toBe(1);
  });

  it('covers admin policy, live transfer, explicit regrant, trusted-access removal, and operations summary boundaries', async () => {
    const adminCookies = await login('owner', 'admin123456');

    const invite = await request(app.getHttpServer())
      .post('/api/admin/invites')
      .set('Cookie', adminCookies)
      .send({ expiresInMinutes: 60 })
      .expect(201);

    const inviteList = await request(app.getHttpServer())
      .get('/api/admin/invites')
      .set('Cookie', adminCookies)
      .expect(200);
    expect(inviteList.body.some((entry: { id: string }) => entry.id === invite.body.id)).toBe(true);

    await request(app.getHttpServer())
      .post('/api/admin/invites/invalidate')
      .set('Cookie', adminCookies)
      .send({ inviteId: invite.body.id })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/admin/policy/publish')
      .set('Cookie', adminCookies)
      .send({
        levelName: 'SECRET',
        defaultConfidentialityLevel: 'CONFIDENTIAL',
        lifecycle: { value: { defaultValidityMinutes: 300, maximumValidityMinutes: 600, allowNeverExpire: false, allowValidityExtensionLater: true, allowFutureTrustedDevices: true, allowOutwardResharing: true } },
        shareAvailability: { value: { allowOutwardSharing: true, restrictToSelfOnly: false, allowRecipientResharing: false, allowMultipleOutwardShares: true, allowUserTargetedSharing: true, allowPasswordExtraction: true, allowPublicLinks: true } },
        userTargetedSharing: { value: { defaultShareValidityMinutes: 240, maximumShareValidityMinutes: 480, allowRepeatDownload: true, allowRecipientMultiDeviceAccess: true } },
        passwordExtraction: { value: { allowPasswordExtraction: true, requireSystemGeneratedPassword: false, maximumRetrievalCount: 4 } },
        publicLinks: { value: { allowPublicLinks: true, maximumPublicLinkValidityMinutes: 120, maximumPublicLinkDownloadCount: 4 } },
        liveTransfer: { value: { allowLiveTransfer: true, allowPeerToPeer: true, allowRelay: true, allowPeerToPeerToRelayFallback: true, allowLiveToStoredFallback: true, retainLiveTransferRecords: true, allowGroupedOrLargeLiveTransfer: true } },
      })
      .expect(201);

    const policyState = await request(app.getHttpServer())
      .get('/api/admin/policy')
      .set('Cookie', adminCookies)
      .expect(200);
    expect(policyState.body.defaultConfidentialityLevel).toBe('CONFIDENTIAL');

    const secretHistory = await request(app.getHttpServer())
      .get('/api/admin/policy/history/SECRET')
      .set('Cookie', adminCookies)
      .expect(200);
    expect(secretHistory.body[0].bundleVersion).toBeGreaterThanOrEqual(2);

    await createApprovedUser('lina', 'lina-password', adminCookies);
    await createApprovedUser('milo', 'milo-password', adminCookies);

    const linaTrust = await bootstrapTrustedUser(
      'lina',
      'lina-password',
      'Lina Browser 1',
      'lina-device-1',
      'lina-domain-key',
    );
    const miloTrust = await bootstrapTrustedUser(
      'milo',
      'milo-password',
      'Milo Browser 1',
      'milo-device-1',
      'milo-domain-key',
    );

    const liveSession = await request(app.getHttpServer())
      .post('/api/live-transfer/sessions')
      .set('Cookie', linaTrust.trustedCookies)
      .send({ contentLabel: 'manual live file', contentKind: 'SINGLE_FILE' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/live-transfer/sessions/join')
      .set('Cookie', miloTrust.trustedCookies)
      .send({ sessionCode: liveSession.body.sessionCode })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/live-transfer/sessions/${liveSession.body.liveTransferSessionId}/confirm`)
      .set('Cookie', linaTrust.trustedCookies)
      .send({ confirmed: true })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/live-transfer/sessions/${liveSession.body.liveTransferSessionId}/transport`)
      .set('Cookie', linaTrust.trustedCookies)
      .send({ transportState: 'RELAY_ACTIVE' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/live-transfer/sessions/${liveSession.body.liveTransferSessionId}/complete`)
      .set('Cookie', miloTrust.trustedCookies)
      .expect(201);

    const liveRecords = await request(app.getHttpServer())
      .get('/api/live-transfer/records')
      .set('Cookie', linaTrust.trustedCookies)
      .expect(200);
    expect(liveRecords.body.some((row: { contentLabel?: string }) => row.contentLabel === 'manual live file')).toBe(true);

    const topSecretLive = await request(app.getHttpServer())
      .post('/api/live-transfer/sessions')
      .set('Cookie', linaTrust.trustedCookies)
      .send({ contentLabel: 'top secret live file', contentKind: 'SINGLE_FILE', confidentialityLevel: 'TOP_SECRET' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/live-transfer/sessions/join')
      .set('Cookie', miloTrust.trustedCookies)
      .send({ sessionCode: topSecretLive.body.sessionCode })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/live-transfer/sessions/${topSecretLive.body.liveTransferSessionId}/confirm`)
      .set('Cookie', linaTrust.trustedCookies)
      .send({ confirmed: true })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/live-transfer/sessions/${topSecretLive.body.liveTransferSessionId}/transport`)
      .set('Cookie', linaTrust.trustedCookies)
      .send({ transportState: 'RELAY_ATTEMPT' })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/live-transfer/sessions/${topSecretLive.body.liveTransferSessionId}/fail`)
      .set('Cookie', linaTrust.trustedCookies)
      .send({ reason: 'transport_exhausted' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/live-transfer/sessions/${topSecretLive.body.liveTransferSessionId}/stored-fallback`)
      .set('Cookie', linaTrust.trustedCookies)
      .expect(400);

    const prepare = await request(app.getHttpServer())
      .post('/api/uploads/prepare')
      .set('Cookie', linaTrust.trustedCookies)
      .send({ contentKind: 'SELF_SPACE_TEXT', confidentialityLevel: 'TOP_SECRET', requestedValidityMinutes: 30 })
      .expect(201);

    const finalize = await request(app.getHttpServer())
      .post(`/api/uploads/${prepare.body.uploadSessionId}/finalize`)
      .set('Cookie', linaTrust.trustedCookies)
      .send({ displayName: 'maintenance item', textCiphertextBody: 'ciphertext maintenance item' })
      .expect(201);

    const pairing = await request(app.getHttpServer())
      .post('/api/trust/pairing-sessions')
      .set('Cookie', linaTrust.trustedCookies)
      .send({ deviceLabel: 'Lina Browser 2', devicePublicIdentity: 'lina-device-2' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/trust/pairing/approve')
      .set('Cookie', linaTrust.trustedCookies)
      .send({ pairingSessionId: pairing.body.id })
      .expect(201);

    const secondDevice = await prisma.trustedDevice.findFirstOrThrow({
      where: { user: { username: 'lina' }, publicIdentityPayload: 'lina-device-2' },
    });
    const secondDeviceCookies = [...linaTrust.sessionCookies, `liminalis_trusted_device=${secondDevice.id}`];

    await request(app.getHttpServer())
      .post(`/api/retrieval/source-items/${finalize.body.sourceItemId}/attempts/lina-second-before-regrant`)
      .set('Cookie', secondDeviceCookies)
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/maintenance/regrant')
      .set('Cookie', linaTrust.trustedCookies)
      .send({ protectedObjectType: 'SOURCE_ITEM', protectedObjectId: finalize.body.sourceItemId })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/retrieval/source-items/${finalize.body.sourceItemId}/attempts/lina-second-after-regrant`)
      .set('Cookie', secondDeviceCookies)
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/maintenance/trusted-access/remove')
      .set('Cookie', linaTrust.trustedCookies)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/retrieval/source-items/${finalize.body.sourceItemId}/attempts/lina-removed-device`)
      .set('Cookie', linaTrust.sessionCookies)
      .expect(403);

    const operations = await request(app.getHttpServer())
      .get('/api/admin/operations/summary')
      .set('Cookie', adminCookies)
      .expect(200);
    expect(typeof operations.body.storage.uploadedCiphertextBytes).toBe('number');
    expect(operations.body).not.toHaveProperty('textCiphertextBody');
  });
});
