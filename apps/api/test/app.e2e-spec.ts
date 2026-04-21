import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { POLICY_BUNDLE_DEFAULTS } from '../src/policy/policy-defaults';
import { createPrismaClient } from '../src/prisma/prisma-client';

describe('M1, M2, and M3 foundation (e2e)', () => {
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
    if (app) {
      await app.close();
    }
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

  it('keeps pending users on the waiting bootstrap surface until admin approval', async () => {
    const adminCookies = await login('owner', 'admin123456');

    const invite = await request(app.getHttpServer())
      .post('/api/admin/invites')
      .set('Cookie', adminCookies)
      .send({ expiresInMinutes: 30 })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/registration/register')
      .send({
        inviteCode: invite.body.code,
        username: 'alice',
        password: 'alice-password',
      })
      .expect(201);

    const aliceCookies = await login('alice', 'alice-password');

    await request(app.getHttpServer())
      .get('/api/bootstrap')
      .set('Cookie', aliceCookies)
      .expect(200)
      .expect({
        accountState: 'waiting_approval',
        trustState: 'none',
        requiresFirstDeviceBootstrap: false,
      });
  });

  it('requires admin role for invite and approval actions', async () => {
    const adminCookies = await login('owner', 'admin123456');

    const invite = await request(app.getHttpServer())
      .post('/api/admin/invites')
      .set('Cookie', adminCookies)
      .send({ expiresInMinutes: 30 })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/registration/register')
      .send({
        inviteCode: invite.body.code,
        username: 'bob',
        password: 'bob-password',
      })
      .expect(201);

    const bobCookies = await login('bob', 'bob-password');

    await request(app.getHttpServer())
      .post('/api/admin/invites')
      .set('Cookie', bobCookies)
      .send({ expiresInMinutes: 30 })
      .expect(403);

    const bob = await prisma.user.findUniqueOrThrow({ where: { username: 'bob' } });

    await request(app.getHttpServer())
      .post('/api/admin/users/approve')
      .set('Cookie', bobCookies)
      .send({ userId: bob.id })
      .expect(403);
  });

  it('routes approved users with no trusted devices into first-device bootstrap and creates recovery interruption output', async () => {
    const adminCookies = await login('owner', 'admin123456');

    const invite = await request(app.getHttpServer())
      .post('/api/admin/invites')
      .set('Cookie', adminCookies)
      .send({ expiresInMinutes: 30 })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/registration/register')
      .send({
        inviteCode: invite.body.code,
        username: 'carol',
        password: 'carol-password',
      })
      .expect(201);

    const carol = await prisma.user.findUniqueOrThrow({ where: { username: 'carol' } });

    await request(app.getHttpServer())
      .post('/api/admin/users/approve')
      .set('Cookie', adminCookies)
      .send({ userId: carol.id })
      .expect(201);

    const carolCookies = await login('carol', 'carol-password');

    await request(app.getHttpServer())
      .get('/api/bootstrap')
      .set('Cookie', carolCookies)
      .expect(200)
      .expect((response) => {
        expect(response.body.accountState).toBe('active');
        expect(response.body.trustState).toBe('untrusted');
        expect(response.body.requiresFirstDeviceBootstrap).toBe(true);
      });

    const bootstrapResponse = await request(app.getHttpServer())
      .post('/api/trust/bootstrap-first-device')
      .set('Cookie', carolCookies)
      .send({
        deviceLabel: 'Carol Browser',
        devicePublicIdentity: 'device-public-identity',
        userDomainPublicKey: 'user-domain-public-key',
      })
      .expect(201);

    expect(bootstrapResponse.body.trustedDeviceId).toBeTruthy();
    expect(bootstrapResponse.body.recoveryCodes).toHaveLength(3);

    await request(app.getHttpServer())
      .get('/api/bootstrap')
      .set('Cookie', carolCookies)
      .expect(200)
      .expect((response) => {
        expect(response.body.accountState).toBe('active');
        expect(response.body.trustState).toBe('trusted');
        expect(response.body.requiresFirstDeviceBootstrap).toBe(false);
        expect(response.body.hasRecoverySet).toBe(true);
        expect(response.body.hasCurrentWrappingKey).toBe(true);
      });
  });

  it('trusts a second device only after explicit same-user approval', async () => {
    const adminCookies = await login('owner', 'admin123456');

    const invite = await request(app.getHttpServer())
      .post('/api/admin/invites')
      .set('Cookie', adminCookies)
      .send({ expiresInMinutes: 30 })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/registration/register')
      .send({
        inviteCode: invite.body.code,
        username: 'dave',
        password: 'dave-password',
      })
      .expect(201);

    const dave = await prisma.user.findUniqueOrThrow({ where: { username: 'dave' } });

    await request(app.getHttpServer())
      .post('/api/admin/users/approve')
      .set('Cookie', adminCookies)
      .send({ userId: dave.id })
      .expect(201);

    const daveCookies = await login('dave', 'dave-password');

    await request(app.getHttpServer())
      .post('/api/trust/bootstrap-first-device')
      .set('Cookie', daveCookies)
      .send({
        deviceLabel: 'Dave Browser 1',
        devicePublicIdentity: 'dave-device-1',
        userDomainPublicKey: 'dave-domain-key',
      })
      .expect(201);

    const pairingSession = await request(app.getHttpServer())
      .post('/api/trust/pairing-sessions')
      .set('Cookie', daveCookies)
      .send({
        deviceLabel: 'Dave Browser 2',
        devicePublicIdentity: 'dave-device-2',
      })
      .expect(201);

    const pendingDevice = await prisma.trustedDevice.findUniqueOrThrow({
      where: { id: pairingSession.body.requesterDeviceId ?? pairingSession.body.id },
    }).catch(async () => {
      const session = await prisma.pairingSession.findUniqueOrThrow({
        where: { id: pairingSession.body.id },
      });

      return prisma.trustedDevice.findUniqueOrThrow({ where: { id: session.requesterDeviceId } });
    });

    expect(pendingDevice.trustState).toBe('UNTRUSTED');

    await request(app.getHttpServer())
      .post('/api/trust/pairing/approve')
      .set('Cookie', daveCookies)
      .send({ pairingSessionId: pairingSession.body.id })
      .expect(201);

    const trustedDevice = await prisma.trustedDevice.findUniqueOrThrow({
      where: { id: pendingDevice.id },
    });

    expect(trustedDevice.trustState).toBe('TRUSTED');
  });

  it('blocks cross-user pairing approval and preserves recovery pending display until acknowledgment', async () => {
    const adminCookies = await login('owner', 'admin123456');

    const inviteOne = await request(app.getHttpServer())
      .post('/api/admin/invites')
      .set('Cookie', adminCookies)
      .send({ expiresInMinutes: 30 })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/registration/register')
      .send({
        inviteCode: inviteOne.body.code,
        username: 'erin',
        password: 'erin-password',
      })
      .expect(201);

    const inviteTwo = await request(app.getHttpServer())
      .post('/api/admin/invites')
      .set('Cookie', adminCookies)
      .send({ expiresInMinutes: 30 })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/registration/register')
      .send({
        inviteCode: inviteTwo.body.code,
        username: 'frank',
        password: 'frank-password',
      })
      .expect(201);

    const erin = await prisma.user.findUniqueOrThrow({ where: { username: 'erin' } });
    const frank = await prisma.user.findUniqueOrThrow({ where: { username: 'frank' } });

    await request(app.getHttpServer())
      .post('/api/admin/users/approve')
      .set('Cookie', adminCookies)
      .send({ userId: erin.id })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/admin/users/approve')
      .set('Cookie', adminCookies)
      .send({ userId: frank.id })
      .expect(201);

    const erinCookies = await login('erin', 'erin-password');
    const frankCookies = await login('frank', 'frank-password');

    const firstDevice = await request(app.getHttpServer())
      .post('/api/trust/bootstrap-first-device')
      .set('Cookie', erinCookies)
      .send({
        deviceLabel: 'Erin Browser 1',
        devicePublicIdentity: 'erin-device-1',
        userDomainPublicKey: 'erin-domain-key',
      })
      .expect(201);

    const pairingSession = await request(app.getHttpServer())
      .post('/api/trust/pairing-sessions')
      .set('Cookie', erinCookies)
      .send({
        deviceLabel: 'Erin Browser 2',
        devicePublicIdentity: 'erin-device-2',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/trust/pairing/approve')
      .set('Cookie', frankCookies)
      .send({ pairingSessionId: pairingSession.body.id })
      .expect(400);

    const recoveryAttempt = await request(app.getHttpServer())
      .post('/api/recovery/attempt')
      .set('Cookie', erinCookies)
      .send({
        recoveryCode: firstDevice.body.recoveryCodes[0],
        deviceLabel: 'Erin Recovery Browser',
        devicePublicIdentity: 'erin-recovery-device',
      })
      .expect(201);

    const pendingDisplay = await request(app.getHttpServer())
      .get('/api/recovery/pending-display')
      .set('Cookie', erinCookies)
      .expect(200);

    expect(pendingDisplay.body.recoveryCodes).toHaveLength(3);
    expect(pendingDisplay.body.recoveryCodes).toEqual(recoveryAttempt.body.recoveryCodes);

    await request(app.getHttpServer())
      .post(`/api/recovery/acknowledge/${recoveryAttempt.body.pendingTrustedDeviceId}`)
      .set('Cookie', erinCookies)
      .expect(201);

    await request(app.getHttpServer())
      .get('/api/recovery/pending-display')
      .set('Cookie', erinCookies)
      .expect(404);
  });

  it('blocks disabled users from new trust establishment and recovery completion', async () => {
    const adminCookies = await login('owner', 'admin123456');

    const invite = await request(app.getHttpServer())
      .post('/api/admin/invites')
      .set('Cookie', adminCookies)
      .send({ expiresInMinutes: 30 })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/registration/register')
      .send({
        inviteCode: invite.body.code,
        username: 'gina',
        password: 'gina-password',
      })
      .expect(201);

    const gina = await prisma.user.findUniqueOrThrow({ where: { username: 'gina' } });

    await request(app.getHttpServer())
      .post('/api/admin/users/approve')
      .set('Cookie', adminCookies)
      .send({ userId: gina.id })
      .expect(201);

    const ginaCookies = await login('gina', 'gina-password');

    const bootstrapResponse = await request(app.getHttpServer())
      .post('/api/trust/bootstrap-first-device')
      .set('Cookie', ginaCookies)
      .send({
        deviceLabel: 'Gina Browser 1',
        devicePublicIdentity: 'gina-device-1',
        userDomainPublicKey: 'gina-domain-key',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/admin/users/disable')
      .set('Cookie', adminCookies)
      .send({ userId: gina.id })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/trust/pairing-sessions')
      .set('Cookie', ginaCookies)
      .send({
        deviceLabel: 'Gina Browser 2',
        devicePublicIdentity: 'gina-device-2',
      })
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/recovery/attempt')
      .set('Cookie', ginaCookies)
      .send({
        recoveryCode: bootstrapResponse.body.recoveryCodes[0],
        deviceLabel: 'Gina Recovery Browser',
        devicePublicIdentity: 'gina-recovery-device',
      })
      .expect(401);
  });

  it('creates a self-space text source item with locked policy snapshot and access structure', async () => {
    const adminCookies = await login('owner', 'admin123456');

    const invite = await request(app.getHttpServer())
      .post('/api/admin/invites')
      .set('Cookie', adminCookies)
      .send({ expiresInMinutes: 30 })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/registration/register')
      .send({
        inviteCode: invite.body.code,
        username: 'harry',
        password: 'harry-password',
      })
      .expect(201);

    const harry = await prisma.user.findUniqueOrThrow({ where: { username: 'harry' } });

    await request(app.getHttpServer())
      .post('/api/admin/users/approve')
      .set('Cookie', adminCookies)
      .send({ userId: harry.id })
      .expect(201);

    const harryCookies = await login('harry', 'harry-password');

    await request(app.getHttpServer())
      .post('/api/trust/bootstrap-first-device')
      .set('Cookie', harryCookies)
      .send({
        deviceLabel: 'Harry Browser 1',
        devicePublicIdentity: 'harry-device-1',
        userDomainPublicKey: 'harry-domain-key',
      })
      .expect(201);

    const prepare = await request(app.getHttpServer())
      .post('/api/uploads/prepare')
      .set('Cookie', harryCookies)
      .send({
        contentKind: 'SELF_SPACE_TEXT',
        confidentialityLevel: 'SECRET',
        requestedValidityMinutes: 30,
        burnAfterReadEnabled: false,
      })
      .expect(201);

    expect(prepare.body.policySnapshot.confidentialityLevel).toBe('SECRET');
    expect(prepare.body.policySnapshot.resolvedValidityMinutes).toBe(30);

    const finalized = await request(app.getHttpServer())
      .post(`/api/uploads/${prepare.body.uploadSessionId}/finalize`)
      .set('Cookie', harryCookies)
      .send({
        textCiphertextBody: 'ciphertext-text-body',
        displayName: 'secret-note',
      })
      .expect(201);

    const sourceItem = await request(app.getHttpServer())
      .get(`/api/source-items/${finalized.body.sourceItemId}`)
      .set('Cookie', harryCookies)
      .expect(200);

    expect(sourceItem.body.contentKind).toBe('SELF_SPACE_TEXT');
    expect(sourceItem.body.textCiphertextBody).toBe('ciphertext-text-body');
    expect(sourceItem.body.accessGrantSets).toHaveLength(1);
    expect(sourceItem.body.accessGrantSets[0].grantSubjectMode).toBe('OWNER_DOMAIN');
  });

  it('requires at least one uploaded part before finalizing a single-file source item', async () => {
    const adminCookies = await login('owner', 'admin123456');

    const invite = await request(app.getHttpServer())
      .post('/api/admin/invites')
      .set('Cookie', adminCookies)
      .send({ expiresInMinutes: 30 })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/registration/register')
      .send({
        inviteCode: invite.body.code,
        username: 'ivy',
        password: 'ivy-password',
      })
      .expect(201);

    const ivy = await prisma.user.findUniqueOrThrow({ where: { username: 'ivy' } });

    await request(app.getHttpServer())
      .post('/api/admin/users/approve')
      .set('Cookie', adminCookies)
      .send({ userId: ivy.id })
      .expect(201);

    const ivyCookies = await login('ivy', 'ivy-password');

    await request(app.getHttpServer())
      .post('/api/trust/bootstrap-first-device')
      .set('Cookie', ivyCookies)
      .send({
        deviceLabel: 'Ivy Browser 1',
        devicePublicIdentity: 'ivy-device-1',
        userDomainPublicKey: 'ivy-domain-key',
      })
      .expect(201);

    const prepare = await request(app.getHttpServer())
      .post('/api/uploads/prepare')
      .set('Cookie', ivyCookies)
      .send({
        contentKind: 'SINGLE_FILE',
        confidentialityLevel: 'CONFIDENTIAL',
        requestedValidityMinutes: 60,
        displayName: 'document.bin',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/uploads/${prepare.body.uploadSessionId}/finalize`)
      .set('Cookie', ivyCookies)
      .send({ displayName: 'document.bin' })
      .expect(400);
  });

  it('creates grouped content source items with manifest and snapshot-limited access for top-secret level', async () => {
    const adminCookies = await login('owner', 'admin123456');

    const invite = await request(app.getHttpServer())
      .post('/api/admin/invites')
      .set('Cookie', adminCookies)
      .send({ expiresInMinutes: 30 })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/registration/register')
      .send({
        inviteCode: invite.body.code,
        username: 'jane',
        password: 'jane-password',
      })
      .expect(201);

    const jane = await prisma.user.findUniqueOrThrow({ where: { username: 'jane' } });

    await request(app.getHttpServer())
      .post('/api/admin/users/approve')
      .set('Cookie', adminCookies)
      .send({ userId: jane.id })
      .expect(201);

    const janeCookies = await login('jane', 'jane-password');

    await request(app.getHttpServer())
      .post('/api/trust/bootstrap-first-device')
      .set('Cookie', janeCookies)
      .send({
        deviceLabel: 'Jane Browser 1',
        devicePublicIdentity: 'jane-device-1',
        userDomainPublicKey: 'jane-domain-key',
      })
      .expect(201);

    const prepare = await request(app.getHttpServer())
      .post('/api/uploads/prepare')
      .set('Cookie', janeCookies)
      .send({
        contentKind: 'GROUPED_CONTENT',
        groupStructureKind: 'FOLDER',
        confidentialityLevel: 'TOP_SECRET',
        requestedValidityMinutes: 30,
        displayName: 'folder-bundle',
      })
      .expect(201);

    expect(prepare.body.policySnapshot.allowFutureTrustedDevices).toBe(false);

    await request(app.getHttpServer())
      .post(`/api/uploads/${prepare.body.uploadSessionId}/parts`)
      .set('Cookie', janeCookies)
      .send({
        partNumber: 1,
        storageKey: 'uploads/jane/folder/part-1.bin',
        byteSize: 1024,
      })
      .expect(201);

    const finalize = await request(app.getHttpServer())
      .post(`/api/uploads/${prepare.body.uploadSessionId}/finalize`)
      .set('Cookie', janeCookies)
      .send({
        displayName: 'folder-bundle',
        manifest: {
          members: [
            {
              memberId: 'a',
              displayName: 'report.pdf',
              relativePath: 'folder/report.pdf',
              memberSize: 1024,
              blobRef: 'uploads/jane/folder/part-1.bin',
            },
          ],
        },
      })
      .expect(201);

    const sourceItem = await request(app.getHttpServer())
      .get(`/api/source-items/${finalize.body.sourceItemId}`)
      .set('Cookie', janeCookies)
      .expect(200);

    expect(sourceItem.body.groupManifest).toBeTruthy();
    expect(sourceItem.body.accessGrantSets).toHaveLength(1);
    expect(sourceItem.body.accessGrantSets[0].grantSubjectMode).toBe('OWNER_DEVICE_SNAPSHOT');
    expect(sourceItem.body.packageFamilies).toHaveLength(2);
  });

  it('issues a protected self-retrieval attempt only for a trusted device and completes it explicitly', async () => {
    const adminCookies = await login('owner', 'admin123456');

    const invite = await request(app.getHttpServer())
      .post('/api/admin/invites')
      .set('Cookie', adminCookies)
      .send({ expiresInMinutes: 30 })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/registration/register')
      .send({
        inviteCode: invite.body.code,
        username: 'kate',
        password: 'kate-password',
      })
      .expect(201);

    const kate = await prisma.user.findUniqueOrThrow({ where: { username: 'kate' } });

    await request(app.getHttpServer())
      .post('/api/admin/users/approve')
      .set('Cookie', adminCookies)
      .send({ userId: kate.id })
      .expect(201);

    const kateSessionCookies = await login('kate', 'kate-password');

    await request(app.getHttpServer())
      .post('/api/uploads/prepare')
      .set('Cookie', kateSessionCookies)
      .send({
        contentKind: 'SELF_SPACE_TEXT',
        confidentialityLevel: 'SECRET',
        requestedValidityMinutes: 30,
      })
      .expect(403);

    const kateTrustResponse = await request(app.getHttpServer())
      .post('/api/trust/bootstrap-first-device')
      .set('Cookie', kateSessionCookies)
      .send({
        deviceLabel: 'Kate Browser 1',
        devicePublicIdentity: 'kate-device-1',
        userDomainPublicKey: 'kate-domain-key',
      })
      .expect(201);

    const kateCookies = mergeCookies(kateSessionCookies, kateTrustResponse.get('set-cookie'));

    const prepare = await request(app.getHttpServer())
      .post('/api/uploads/prepare')
      .set('Cookie', kateCookies)
      .send({
        contentKind: 'SELF_SPACE_TEXT',
        confidentialityLevel: 'SECRET',
        requestedValidityMinutes: 30,
      })
      .expect(201);

    const finalize = await request(app.getHttpServer())
      .post(`/api/uploads/${prepare.body.uploadSessionId}/finalize`)
      .set('Cookie', kateCookies)
      .send({
        displayName: 'retrievable-note',
        textCiphertextBody: 'ciphertext-retrievable-note',
      })
      .expect(201);

    const issueAttempt = await request(app.getHttpServer())
      .post(`/api/retrieval/source-items/${finalize.body.sourceItemId}/attempts/attempt-1`)
      .set('Cookie', kateCookies)
      .expect(201);

    expect(issueAttempt.body.packageReferenceId).toBeTruthy();
    expect(issueAttempt.body.packageFamilyKind).toBe('OWNER_ORDINARY');
    expect(issueAttempt.body.textCiphertextBody).toBe('ciphertext-retrievable-note');

    await request(app.getHttpServer())
      .post(`/api/retrieval/attempts/${issueAttempt.body.retrievalAttemptId}/complete`)
      .set('Cookie', kateCookies)
      .send({ success: true })
      .expect(201)
      .expect((response) => {
        expect(response.body.status).toBe('COMPLETED');
        expect(response.body.sourceItemState).toBe('ACTIVE');
      });
  });

  it('purges burn-after-read self-space source items immediately after successful protected completion', async () => {
    const adminCookies = await login('owner', 'admin123456');

    const invite = await request(app.getHttpServer())
      .post('/api/admin/invites')
      .set('Cookie', adminCookies)
      .send({ expiresInMinutes: 30 })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/registration/register')
      .send({
        inviteCode: invite.body.code,
        username: 'lena',
        password: 'lena-password',
      })
      .expect(201);

    const lena = await prisma.user.findUniqueOrThrow({ where: { username: 'lena' } });

    await request(app.getHttpServer())
      .post('/api/admin/users/approve')
      .set('Cookie', adminCookies)
      .send({ userId: lena.id })
      .expect(201);

    const lenaSessionCookies = await login('lena', 'lena-password');

    const lenaTrustResponse = await request(app.getHttpServer())
      .post('/api/trust/bootstrap-first-device')
      .set('Cookie', lenaSessionCookies)
      .send({
        deviceLabel: 'Lena Browser 1',
        devicePublicIdentity: 'lena-device-1',
        userDomainPublicKey: 'lena-domain-key',
      })
      .expect(201);

    const lenaCookies = mergeCookies(lenaSessionCookies, lenaTrustResponse.get('set-cookie'));

    const prepare = await request(app.getHttpServer())
      .post('/api/uploads/prepare')
      .set('Cookie', lenaCookies)
      .send({
        contentKind: 'SELF_SPACE_TEXT',
        confidentialityLevel: 'SECRET',
        requestedValidityMinutes: 30,
        burnAfterReadEnabled: true,
      })
      .expect(201);

    const finalize = await request(app.getHttpServer())
      .post(`/api/uploads/${prepare.body.uploadSessionId}/finalize`)
      .set('Cookie', lenaCookies)
      .send({
        displayName: 'burn-note',
        textCiphertextBody: 'ciphertext-burn-note',
      })
      .expect(201);

    const issueAttempt = await request(app.getHttpServer())
      .post(`/api/retrieval/source-items/${finalize.body.sourceItemId}/attempts/attempt-burn`)
      .set('Cookie', lenaCookies)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/retrieval/attempts/${issueAttempt.body.retrievalAttemptId}/complete`)
      .set('Cookie', lenaCookies)
      .send({ success: true })
      .expect(201)
      .expect((response) => {
        expect(response.body.status).toBe('COMPLETED');
        expect(response.body.sourceItemState).toBe('PURGED');
      });

    await request(app.getHttpServer())
      .post(`/api/retrieval/source-items/${finalize.body.sourceItemId}/attempts/attempt-after-burn`)
      .set('Cookie', lenaCookies)
      .expect(400);
  });

  it('projects active timeline, retained history, and narrow search from current source-item write state', async () => {
    const adminCookies = await login('owner', 'admin123456');

    const invite = await request(app.getHttpServer())
      .post('/api/admin/invites')
      .set('Cookie', adminCookies)
      .send({ expiresInMinutes: 30 })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/registration/register')
      .send({
        inviteCode: invite.body.code,
        username: 'mira',
        password: 'mira-password',
      })
      .expect(201);

    const mira = await prisma.user.findUniqueOrThrow({ where: { username: 'mira' } });

    await request(app.getHttpServer())
      .post('/api/admin/users/approve')
      .set('Cookie', adminCookies)
      .send({ userId: mira.id })
      .expect(201);

    const miraSessionCookies = await login('mira', 'mira-password');
    const miraTrustResponse = await request(app.getHttpServer())
      .post('/api/trust/bootstrap-first-device')
      .set('Cookie', miraSessionCookies)
      .send({
        deviceLabel: 'Mira Browser 1',
        devicePublicIdentity: 'mira-device-1',
        userDomainPublicKey: 'mira-domain-key',
      })
      .expect(201);

    const miraCookies = mergeCookies(miraSessionCookies, miraTrustResponse.get('set-cookie'));

    const activePrepare = await request(app.getHttpServer())
      .post('/api/uploads/prepare')
      .set('Cookie', miraCookies)
      .send({
        contentKind: 'SELF_SPACE_TEXT',
        confidentialityLevel: 'SECRET',
        requestedValidityMinutes: 30,
      })
      .expect(201);

    const activeFinalize = await request(app.getHttpServer())
      .post(`/api/uploads/${activePrepare.body.uploadSessionId}/finalize`)
      .set('Cookie', miraCookies)
      .send({
        displayName: 'active note',
        textCiphertextBody: 'ciphertext active body',
      })
      .expect(201);

    const burnPrepare = await request(app.getHttpServer())
      .post('/api/uploads/prepare')
      .set('Cookie', miraCookies)
      .send({
        contentKind: 'SELF_SPACE_TEXT',
        confidentialityLevel: 'SECRET',
        requestedValidityMinutes: 30,
        burnAfterReadEnabled: true,
      })
      .expect(201);

    const burnFinalize = await request(app.getHttpServer())
      .post(`/api/uploads/${burnPrepare.body.uploadSessionId}/finalize`)
      .set('Cookie', miraCookies)
      .send({
        displayName: 'burn note',
        textCiphertextBody: 'ciphertext burn body',
      })
      .expect(201);

    const burnAttempt = await request(app.getHttpServer())
      .post(`/api/retrieval/source-items/${burnFinalize.body.sourceItemId}/attempts/attempt-mira-burn`)
      .set('Cookie', miraCookies)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/retrieval/attempts/${burnAttempt.body.retrievalAttemptId}/complete`)
      .set('Cookie', miraCookies)
      .send({ success: true })
      .expect(201);

    const timeline = await request(app.getHttpServer())
      .get('/api/timeline')
      .set('Cookie', miraCookies)
      .expect(200);

    expect(timeline.body).toHaveLength(1);
    expect(timeline.body[0].sourceObjectId).toBe(activeFinalize.body.sourceItemId);
    expect(timeline.body[0].displayTitle).toBe('active note');
    expect(timeline.body[0].currentRetrievable).toBe(true);

    const history = await request(app.getHttpServer())
      .get('/api/history')
      .set('Cookie', miraCookies)
      .expect(200);

    const activeHistory = history.body.find(
      (entry: { sourceObjectId: string }) => entry.sourceObjectId === activeFinalize.body.sourceItemId,
    );
    const burnedHistory = history.body.find(
      (entry: { sourceObjectId: string }) => entry.sourceObjectId === burnFinalize.body.sourceItemId,
    );

    expect(activeHistory.retainedStatus).toBe('active');
    expect(activeHistory.retrievable).toBe(true);
    expect(burnedHistory.retainedStatus).toBe('purged');
    expect(burnedHistory.retrievable).toBe(false);
    expect(burnedHistory.concreteReason).toBe('purged');

    const searchActive = await request(app.getHttpServer())
      .get('/api/search')
      .query({ q: 'active note' })
      .set('Cookie', miraCookies)
      .expect(200);

    expect(searchActive.body).toHaveLength(1);
    expect(searchActive.body[0].displayTitle).toBe('active note');

    const searchBodyWord = await request(app.getHttpServer())
      .get('/api/search')
      .query({ q: 'ciphertext' })
      .set('Cookie', miraCookies)
      .expect(200);

    expect(searchBodyWord.body).toHaveLength(0);
  });

  it('blocks user-targeted protected sharing when the recipient has no trusted-device wrapping material', async () => {
    const adminCookies = await login('owner', 'admin123456');

    const inviteSender = await request(app.getHttpServer())
      .post('/api/admin/invites')
      .set('Cookie', adminCookies)
      .send({ expiresInMinutes: 30 })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/registration/register')
      .send({
        inviteCode: inviteSender.body.code,
        username: 'nina',
        password: 'nina-password',
      })
      .expect(201);

    const inviteRecipient = await request(app.getHttpServer())
      .post('/api/admin/invites')
      .set('Cookie', adminCookies)
      .send({ expiresInMinutes: 30 })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/registration/register')
      .send({
        inviteCode: inviteRecipient.body.code,
        username: 'otto',
        password: 'otto-password',
      })
      .expect(201);

    const nina = await prisma.user.findUniqueOrThrow({ where: { username: 'nina' } });
    const otto = await prisma.user.findUniqueOrThrow({ where: { username: 'otto' } });

    await request(app.getHttpServer())
      .post('/api/admin/users/approve')
      .set('Cookie', adminCookies)
      .send({ userId: nina.id })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/admin/users/approve')
      .set('Cookie', adminCookies)
      .send({ userId: otto.id })
      .expect(201);

    const ninaSessionCookies = await login('nina', 'nina-password');
    const ninaTrustResponse = await request(app.getHttpServer())
      .post('/api/trust/bootstrap-first-device')
      .set('Cookie', ninaSessionCookies)
      .send({
        deviceLabel: 'Nina Browser 1',
        devicePublicIdentity: 'nina-device-1',
        userDomainPublicKey: 'nina-domain-key',
      })
      .expect(201);

    const ninaCookies = mergeCookies(ninaSessionCookies, ninaTrustResponse.get('set-cookie'));

    const prepare = await request(app.getHttpServer())
      .post('/api/uploads/prepare')
      .set('Cookie', ninaCookies)
      .send({
        contentKind: 'SELF_SPACE_TEXT',
        confidentialityLevel: 'SECRET',
        requestedValidityMinutes: 30,
      })
      .expect(201);

    const finalize = await request(app.getHttpServer())
      .post(`/api/uploads/${prepare.body.uploadSessionId}/finalize`)
      .set('Cookie', ninaCookies)
      .send({
        displayName: 'share candidate',
        textCiphertextBody: 'ciphertext share body',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/shares')
      .set('Cookie', ninaCookies)
      .send({
        sourceItemId: finalize.body.sourceItemId,
        recipientUsername: 'otto',
        requestedValidityMinutes: 30,
      })
      .expect(400);
  });

  it('creates and consumes a no-repeat protected share for the recipient access domain', async () => {
    const adminCookies = await login('owner', 'admin123456');

    const inviteSender = await request(app.getHttpServer())
      .post('/api/admin/invites')
      .set('Cookie', adminCookies)
      .send({ expiresInMinutes: 30 })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/registration/register')
      .send({
        inviteCode: inviteSender.body.code,
        username: 'piper',
        password: 'piper-password',
      })
      .expect(201);

    const inviteRecipient = await request(app.getHttpServer())
      .post('/api/admin/invites')
      .set('Cookie', adminCookies)
      .send({ expiresInMinutes: 30 })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/registration/register')
      .send({
        inviteCode: inviteRecipient.body.code,
        username: 'quinn',
        password: 'quinn-password',
      })
      .expect(201);

    const piper = await prisma.user.findUniqueOrThrow({ where: { username: 'piper' } });
    const quinn = await prisma.user.findUniqueOrThrow({ where: { username: 'quinn' } });

    await request(app.getHttpServer())
      .post('/api/admin/users/approve')
      .set('Cookie', adminCookies)
      .send({ userId: piper.id })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/admin/users/approve')
      .set('Cookie', adminCookies)
      .send({ userId: quinn.id })
      .expect(201);

    const piperSessionCookies = await login('piper', 'piper-password');
    const piperTrustResponse = await request(app.getHttpServer())
      .post('/api/trust/bootstrap-first-device')
      .set('Cookie', piperSessionCookies)
      .send({
        deviceLabel: 'Piper Browser 1',
        devicePublicIdentity: 'piper-device-1',
        userDomainPublicKey: 'piper-domain-key',
      })
      .expect(201);
    const piperCookies = mergeCookies(piperSessionCookies, piperTrustResponse.get('set-cookie'));

    const quinnSessionCookies = await login('quinn', 'quinn-password');
    const quinnTrustResponse = await request(app.getHttpServer())
      .post('/api/trust/bootstrap-first-device')
      .set('Cookie', quinnSessionCookies)
      .send({
        deviceLabel: 'Quinn Browser 1',
        devicePublicIdentity: 'quinn-device-1',
        userDomainPublicKey: 'quinn-domain-key',
      })
      .expect(201);
    const quinnCookies = mergeCookies(quinnSessionCookies, quinnTrustResponse.get('set-cookie'));

    const prepare = await request(app.getHttpServer())
      .post('/api/uploads/prepare')
      .set('Cookie', piperCookies)
      .send({
        contentKind: 'SELF_SPACE_TEXT',
        confidentialityLevel: 'TOP_SECRET',
        requestedValidityMinutes: 30,
      })
      .expect(201);

    const finalize = await request(app.getHttpServer())
      .post(`/api/uploads/${prepare.body.uploadSessionId}/finalize`)
      .set('Cookie', piperCookies)
      .send({
        displayName: 'no-repeat share',
        textCiphertextBody: 'ciphertext no-repeat body',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/shares')
      .set('Cookie', piperCookies)
      .send({
        sourceItemId: finalize.body.sourceItemId,
        recipientUsername: 'quinn',
        requestedValidityMinutes: 30,
      })
      .expect(400);

    await prisma.policyBundle.updateMany({
      where: { levelName: 'TOP_SECRET', isCurrent: true },
      data: {
        shareAvailability: {
          allowOutwardSharing: true,
          restrictToSelfOnly: false,
          allowRecipientResharing: false,
          allowMultipleOutwardShares: true,
          allowUserTargetedSharing: true,
          allowPasswordExtraction: false,
          allowPublicLinks: false,
        },
        userTargetedSharing: {
          defaultShareValidityMinutes: 30,
          maximumShareValidityMinutes: 60,
          allowRepeatDownload: false,
          allowRecipientMultiDeviceAccess: true,
        },
      },
    });

    const share = await request(app.getHttpServer())
      .post('/api/shares')
      .set('Cookie', piperCookies)
      .send({
        sourceItemId: finalize.body.sourceItemId,
        recipientUsername: 'quinn',
        requestedValidityMinutes: 30,
      })
      .expect(201);

    expect(share.body.allowRepeatDownload).toBe(false);
    expect(share.body.allowRecipientMultiDeviceAccess).toBe(true);

    const incoming = await request(app.getHttpServer())
      .get('/api/shares/incoming')
      .set('Cookie', quinnCookies)
      .expect(200);

    expect(incoming.body).toHaveLength(1);

    const issueAttempt = await request(app.getHttpServer())
      .post(`/api/shares/${share.body.shareObjectId}/attempts/recipient-attempt-1`)
      .set('Cookie', quinnCookies)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/shares/attempts/${issueAttempt.body.retrievalAttemptId}/complete`)
      .set('Cookie', quinnCookies)
      .send({ success: true })
      .expect(201)
      .expect((response) => {
        expect(response.body.shareState).toBe('INACTIVE');
        expect(response.body.inactiveReason).toBe('CONSUMED');
      });

    await request(app.getHttpServer())
      .post(`/api/shares/${share.body.shareObjectId}/attempts/recipient-attempt-2`)
      .set('Cookie', quinnCookies)
      .expect(400);

    const history = await request(app.getHttpServer())
      .get('/api/history')
      .set('Cookie', quinnCookies)
      .expect(200);

    const consumed = history.body.find(
      (entry: { sourceObjectId: string }) => entry.sourceObjectId === share.body.shareObjectId,
    );
    expect(consumed.retainedStatus).toBe('consumed');
    expect(consumed.retrievable).toBe(false);
  });

  it('creates extraction access, escalates to captcha after one failed password, and decrements count on successful completion', async () => {
    const adminCookies = await login('owner', 'admin123456');

    const inviteSender = await request(app.getHttpServer())
      .post('/api/admin/invites')
      .set('Cookie', adminCookies)
      .send({ expiresInMinutes: 30 })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/registration/register')
      .send({
        inviteCode: inviteSender.body.code,
        username: 'rhea',
        password: 'rhea-password',
      })
      .expect(201);

    const inviteRecipient = await request(app.getHttpServer())
      .post('/api/admin/invites')
      .set('Cookie', adminCookies)
      .send({ expiresInMinutes: 30 })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/registration/register')
      .send({
        inviteCode: inviteRecipient.body.code,
        username: 'soren',
        password: 'soren-password',
      })
      .expect(201);

    const rhea = await prisma.user.findUniqueOrThrow({ where: { username: 'rhea' } });
    const soren = await prisma.user.findUniqueOrThrow({ where: { username: 'soren' } });

    await request(app.getHttpServer())
      .post('/api/admin/users/approve')
      .set('Cookie', adminCookies)
      .send({ userId: rhea.id })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/admin/users/approve')
      .set('Cookie', adminCookies)
      .send({ userId: soren.id })
      .expect(201);

    const rheaSessionCookies = await login('rhea', 'rhea-password');
    const rheaTrustResponse = await request(app.getHttpServer())
      .post('/api/trust/bootstrap-first-device')
      .set('Cookie', rheaSessionCookies)
      .send({
        deviceLabel: 'Rhea Browser 1',
        devicePublicIdentity: 'rhea-device-1',
        userDomainPublicKey: 'rhea-domain-key',
      })
      .expect(201);
    const rheaCookies = mergeCookies(rheaSessionCookies, rheaTrustResponse.get('set-cookie'));

    const sorenSessionCookies = await login('soren', 'soren-password');
    const sorenTrustResponse = await request(app.getHttpServer())
      .post('/api/trust/bootstrap-first-device')
      .set('Cookie', sorenSessionCookies)
      .send({
        deviceLabel: 'Soren Browser 1',
        devicePublicIdentity: 'soren-device-1',
        userDomainPublicKey: 'soren-domain-key',
      })
      .expect(201);
    const sorenCookies = mergeCookies(sorenSessionCookies, sorenTrustResponse.get('set-cookie'));

    const prepare = await request(app.getHttpServer())
      .post('/api/uploads/prepare')
      .set('Cookie', rheaCookies)
      .send({
        contentKind: 'SELF_SPACE_TEXT',
        confidentialityLevel: 'SECRET',
        requestedValidityMinutes: 30,
      })
      .expect(201);

    const finalize = await request(app.getHttpServer())
      .post(`/api/uploads/${prepare.body.uploadSessionId}/finalize`)
      .set('Cookie', rheaCookies)
      .send({
        displayName: 'extractable note',
        textCiphertextBody: 'ciphertext extractable body',
      })
      .expect(201);

    const share = await request(app.getHttpServer())
      .post('/api/shares')
      .set('Cookie', rheaCookies)
      .send({
        sourceItemId: finalize.body.sourceItemId,
        recipientUsername: 'soren',
        requestedValidityMinutes: 30,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/shares/${share.body.shareObjectId}/attempts/recipient-attempt-1`)
      .set('Cookie', sorenCookies)
      .expect(201);

    const extraction = await request(app.getHttpServer())
      .post('/api/extraction')
      .set('Cookie', rheaCookies)
      .send({
        shareObjectId: share.body.shareObjectId,
        password: 'custom-password-1',
        requestedRetrievalCount: 2,
      })
      .expect(201);

    expect(extraction.body.password).toBe('custom-password-1');
    expect(extraction.body.remainingRetrievalCount).toBe(2);

    await request(app.getHttpServer())
      .post(`/api/extraction/${extraction.body.entryToken}/attempts/extract-attempt-1`)
      .send({ password: 'wrong-password' })
      .expect(403);

    const challenge = await request(app.getHttpServer())
      .get(`/api/extraction/${extraction.body.entryToken}`)
      .expect(200);

    expect(challenge.body.state).toBe('CHALLENGE_REQUIRED');
    expect(challenge.body.requiresCaptcha).toBe(true);

    const extractionAttempt = await request(app.getHttpServer())
      .post(`/api/extraction/${extraction.body.entryToken}/attempts/extract-attempt-1`)
      .send({ password: 'custom-password-1', captchaSatisfied: true })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/extraction/attempts/${extractionAttempt.body.retrievalAttemptId}/complete`)
      .send({ success: true })
      .expect(201)
      .expect((response) => {
        expect(response.body.extractionState).toBe('ACTIVE');
        expect(response.body.remainingRetrievalCount).toBe(1);
      });

    const afterFirstCompletion = await request(app.getHttpServer())
      .get(`/api/extraction/${extraction.body.entryToken}`)
      .expect(200);

    expect(afterFirstCompletion.body.remainingRetrievalCount).toBe(1);
  });

  it('blocks extraction when policy disables password extraction and uses system-generated passwords when required', async () => {
    const adminCookies = await login('owner', 'admin123456');

    const inviteSender = await request(app.getHttpServer())
      .post('/api/admin/invites')
      .set('Cookie', adminCookies)
      .send({ expiresInMinutes: 30 })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/registration/register')
      .send({
        inviteCode: inviteSender.body.code,
        username: 'talia',
        password: 'talia-password',
      })
      .expect(201);

    const inviteRecipient = await request(app.getHttpServer())
      .post('/api/admin/invites')
      .set('Cookie', adminCookies)
      .send({ expiresInMinutes: 30 })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/registration/register')
      .send({
        inviteCode: inviteRecipient.body.code,
        username: 'ulric',
        password: 'ulric-password',
      })
      .expect(201);

    const talia = await prisma.user.findUniqueOrThrow({ where: { username: 'talia' } });
    const ulric = await prisma.user.findUniqueOrThrow({ where: { username: 'ulric' } });

    await request(app.getHttpServer())
      .post('/api/admin/users/approve')
      .set('Cookie', adminCookies)
      .send({ userId: talia.id })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/admin/users/approve')
      .set('Cookie', adminCookies)
      .send({ userId: ulric.id })
      .expect(201);

    const taliaSessionCookies = await login('talia', 'talia-password');
    const taliaTrustResponse = await request(app.getHttpServer())
      .post('/api/trust/bootstrap-first-device')
      .set('Cookie', taliaSessionCookies)
      .send({
        deviceLabel: 'Talia Browser 1',
        devicePublicIdentity: 'talia-device-1',
        userDomainPublicKey: 'talia-domain-key',
      })
      .expect(201);
    const taliaCookies = mergeCookies(taliaSessionCookies, taliaTrustResponse.get('set-cookie'));

    const ulricSessionCookies = await login('ulric', 'ulric-password');
    const ulricTrustResponse = await request(app.getHttpServer())
      .post('/api/trust/bootstrap-first-device')
      .set('Cookie', ulricSessionCookies)
      .send({
        deviceLabel: 'Ulric Browser 1',
        devicePublicIdentity: 'ulric-device-1',
        userDomainPublicKey: 'ulric-domain-key',
      })
      .expect(201);
    const ulricCookies = mergeCookies(ulricSessionCookies, ulricTrustResponse.get('set-cookie'));

    const prepare = await request(app.getHttpServer())
      .post('/api/uploads/prepare')
      .set('Cookie', taliaCookies)
      .send({
        contentKind: 'SELF_SPACE_TEXT',
        confidentialityLevel: 'CONFIDENTIAL',
        requestedValidityMinutes: 30,
      })
      .expect(201);

    const finalize = await request(app.getHttpServer())
      .post(`/api/uploads/${prepare.body.uploadSessionId}/finalize`)
      .set('Cookie', taliaCookies)
      .send({
        displayName: 'confidential note',
        textCiphertextBody: 'ciphertext confidential body',
      })
      .expect(201);

    const share = await request(app.getHttpServer())
      .post('/api/shares')
      .set('Cookie', taliaCookies)
      .send({
        sourceItemId: finalize.body.sourceItemId,
        recipientUsername: 'ulric',
        requestedValidityMinutes: 30,
      })
      .expect(201);

    const confidentialExtraction = await request(app.getHttpServer())
      .post('/api/extraction')
      .set('Cookie', taliaCookies)
      .send({
        shareObjectId: share.body.shareObjectId,
        password: 'ignored-custom-password',
        requestedRetrievalCount: 2,
      })
      .expect(201);

    expect(confidentialExtraction.body.password).not.toBe('ignored-custom-password');
    expect(confidentialExtraction.body.password.length).toBeGreaterThanOrEqual(24);

    await prisma.policyBundle.updateMany({
      where: { levelName: 'CONFIDENTIAL', isCurrent: true },
      data: {
        shareAvailability: {
          allowOutwardSharing: true,
          restrictToSelfOnly: false,
          allowRecipientResharing: false,
          allowMultipleOutwardShares: true,
          allowUserTargetedSharing: true,
          allowPasswordExtraction: false,
          allowPublicLinks: false,
        },
      },
    });

    const prepareBlocked = await request(app.getHttpServer())
      .post('/api/uploads/prepare')
      .set('Cookie', taliaCookies)
      .send({
        contentKind: 'SELF_SPACE_TEXT',
        confidentialityLevel: 'CONFIDENTIAL',
        requestedValidityMinutes: 30,
      })
      .expect(201);

    const finalizeBlocked = await request(app.getHttpServer())
      .post(`/api/uploads/${prepareBlocked.body.uploadSessionId}/finalize`)
      .set('Cookie', taliaCookies)
      .send({
        displayName: 'blocked extraction note',
        textCiphertextBody: 'ciphertext blocked extraction body',
      })
      .expect(201);

    const blockedShare = await request(app.getHttpServer())
      .post('/api/shares')
      .set('Cookie', taliaCookies)
      .send({
        sourceItemId: finalizeBlocked.body.sourceItemId,
        recipientUsername: 'ulric',
        requestedValidityMinutes: 30,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/extraction')
      .set('Cookie', taliaCookies)
      .send({
        shareObjectId: blockedShare.body.shareObjectId,
        requestedRetrievalCount: 1,
      })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/shares/${share.body.shareObjectId}/attempts/recipient-attempt-policy-check`)
      .set('Cookie', ulricCookies)
      .expect(201);
  });

  it('creates tracked public links and decrements download count only on ticket redemption', async () => {
    const adminCookies = await login('owner', 'admin123456');

    const inviteSender = await request(app.getHttpServer())
      .post('/api/admin/invites')
      .set('Cookie', adminCookies)
      .send({ expiresInMinutes: 30 })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/registration/register')
      .send({
        inviteCode: inviteSender.body.code,
        username: 'vera',
        password: 'vera-password',
      })
      .expect(201);

    const inviteRecipient = await request(app.getHttpServer())
      .post('/api/admin/invites')
      .set('Cookie', adminCookies)
      .send({ expiresInMinutes: 30 })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/registration/register')
      .send({
        inviteCode: inviteRecipient.body.code,
        username: 'wynn',
        password: 'wynn-password',
      })
      .expect(201);

    const vera = await prisma.user.findUniqueOrThrow({ where: { username: 'vera' } });
    const wynn = await prisma.user.findUniqueOrThrow({ where: { username: 'wynn' } });

    await request(app.getHttpServer())
      .post('/api/admin/users/approve')
      .set('Cookie', adminCookies)
      .send({ userId: vera.id })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/admin/users/approve')
      .set('Cookie', adminCookies)
      .send({ userId: wynn.id })
      .expect(201);

    const veraSessionCookies = await login('vera', 'vera-password');
    const veraTrustResponse = await request(app.getHttpServer())
      .post('/api/trust/bootstrap-first-device')
      .set('Cookie', veraSessionCookies)
      .send({
        deviceLabel: 'Vera Browser 1',
        devicePublicIdentity: 'vera-device-1',
        userDomainPublicKey: 'vera-domain-key',
      })
      .expect(201);
    const veraCookies = mergeCookies(veraSessionCookies, veraTrustResponse.get('set-cookie'));

    const wynnSessionCookies = await login('wynn', 'wynn-password');
    const wynnTrustResponse = await request(app.getHttpServer())
      .post('/api/trust/bootstrap-first-device')
      .set('Cookie', wynnSessionCookies)
      .send({
        deviceLabel: 'Wynn Browser 1',
        devicePublicIdentity: 'wynn-device-1',
        userDomainPublicKey: 'wynn-domain-key',
      })
      .expect(201);
    const wynnCookies = mergeCookies(wynnSessionCookies, wynnTrustResponse.get('set-cookie'));

    const prepare = await request(app.getHttpServer())
      .post('/api/uploads/prepare')
      .set('Cookie', veraCookies)
      .send({
        contentKind: 'SELF_SPACE_TEXT',
        confidentialityLevel: 'SECRET',
        requestedValidityMinutes: 30,
      })
      .expect(201);

    const finalize = await request(app.getHttpServer())
      .post(`/api/uploads/${prepare.body.uploadSessionId}/finalize`)
      .set('Cookie', veraCookies)
      .send({
        displayName: 'public note',
        textCiphertextBody: 'ciphertext public body',
      })
      .expect(201);

    const share = await request(app.getHttpServer())
      .post('/api/shares')
      .set('Cookie', veraCookies)
      .send({
        sourceItemId: finalize.body.sourceItemId,
        recipientUsername: 'wynn',
        requestedValidityMinutes: 30,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/shares/${share.body.shareObjectId}/attempts/recipient-attempt-public-check`)
      .set('Cookie', wynnCookies)
      .expect(201);

    const publicLink = await request(app.getHttpServer())
      .post('/api/public-links')
      .set('Cookie', veraCookies)
      .send({
        shareObjectId: share.body.shareObjectId,
        requestedValidityMinutes: 30,
        requestedDownloadCount: 2,
      })
      .expect(201);

    expect(publicLink.body.remainingDownloadCount).toBe(2);

    const linkInfo = await request(app.getHttpServer())
      .get(`/api/public-links/${publicLink.body.linkToken}`)
      .expect(200);

    expect(linkInfo.body.state).toBe('ACTIVE');
    expect(linkInfo.body.remainingDownloadCount).toBe(2);

    const ticket = await request(app.getHttpServer())
      .post(`/api/public-links/${publicLink.body.linkToken}/tickets`)
      .expect(201);

    const redeemed = await request(app.getHttpServer())
      .post(`/api/public-links/tickets/${ticket.body.ticketToken}/redeem`)
      .expect(201);

    expect(redeemed.body.remainingDownloadCount).toBe(1);
    expect(redeemed.body.textCiphertextBody).toBe('ciphertext public body');

    const afterRedeem = await request(app.getHttpServer())
      .get(`/api/public-links/${publicLink.body.linkToken}`)
      .expect(200);

    expect(afterRedeem.body.remainingDownloadCount).toBe(1);

    await prisma.policyBundle.updateMany({
      where: { levelName: 'SECRET', isCurrent: true },
      data: {
        shareAvailability: {
          allowOutwardSharing: true,
          restrictToSelfOnly: false,
          allowRecipientResharing: false,
          allowMultipleOutwardShares: true,
          allowUserTargetedSharing: true,
          allowPasswordExtraction: true,
          allowPublicLinks: false,
        },
      },
    });

    const prepareBlocked = await request(app.getHttpServer())
      .post('/api/uploads/prepare')
      .set('Cookie', veraCookies)
      .send({
        contentKind: 'SELF_SPACE_TEXT',
        confidentialityLevel: 'SECRET',
        requestedValidityMinutes: 30,
      })
      .expect(201);

    const finalizeBlocked = await request(app.getHttpServer())
      .post(`/api/uploads/${prepareBlocked.body.uploadSessionId}/finalize`)
      .set('Cookie', veraCookies)
      .send({
        displayName: 'blocked public note',
        textCiphertextBody: 'ciphertext blocked public body',
      })
      .expect(201);

    const blockedShare = await request(app.getHttpServer())
      .post('/api/shares')
      .set('Cookie', veraCookies)
      .send({
        sourceItemId: finalizeBlocked.body.sourceItemId,
        recipientUsername: 'wynn',
        requestedValidityMinutes: 30,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/public-links')
      .set('Cookie', veraCookies)
      .send({
        shareObjectId: blockedShare.body.shareObjectId,
        requestedDownloadCount: 1,
      })
      .expect(400);
  });

  it('lists and invalidates invites through the admin control plane', async () => {
    const adminCookies = await login('owner', 'admin123456');

    const invite = await request(app.getHttpServer())
      .post('/api/admin/invites')
      .set('Cookie', adminCookies)
      .send({ expiresInMinutes: 30 })
      .expect(201);

    const inviteList = await request(app.getHttpServer())
      .get('/api/admin/invites')
      .set('Cookie', adminCookies)
      .expect(200);

    const listed = inviteList.body.find((entry: { id: string }) => entry.id === invite.body.id);
    expect(listed.code).toBe(invite.body.code);
    expect(listed.invalidatedAt).toBeNull();

    await request(app.getHttpServer())
      .post('/api/admin/invites/invalidate')
      .set('Cookie', adminCookies)
      .send({ inviteId: invite.body.id })
      .expect(201);

    const invalidatedList = await request(app.getHttpServer())
      .get('/api/admin/invites')
      .set('Cookie', adminCookies)
      .expect(200);

    const invalidated = invalidatedList.body.find((entry: { id: string }) => entry.id === invite.body.id);
    expect(invalidated.invalidatedAt).toBeTruthy();
  });

  it('publishes new policy bundle versions, updates default level, and restores defaults through admin policy routes', async () => {
    const adminCookies = await login('owner', 'admin123456');

    const initialPolicy = await request(app.getHttpServer())
      .get('/api/admin/policy')
      .set('Cookie', adminCookies)
      .expect(200);

    expect(initialPolicy.body.defaultConfidentialityLevel).toBe('SECRET');

    const secretBundle = initialPolicy.body.currentBundles.find(
      (bundle: { levelName: string }) => bundle.levelName === 'SECRET',
    );
    expect(secretBundle.bundleVersion).toBe(1);

    await request(app.getHttpServer())
      .post('/api/admin/policy/publish')
      .set('Cookie', adminCookies)
      .send({
        levelName: 'SECRET',
        defaultConfidentialityLevel: 'CONFIDENTIAL',
        lifecycle: {
          value: {
            defaultValidityMinutes: 300,
            maximumValidityMinutes: 600,
            allowNeverExpire: false,
            allowValidityExtensionLater: true,
            allowFutureTrustedDevices: true,
            allowOutwardResharing: true,
          },
        },
        shareAvailability: {
          value: {
            allowOutwardSharing: true,
            restrictToSelfOnly: false,
            allowRecipientResharing: false,
            allowMultipleOutwardShares: true,
            allowUserTargetedSharing: true,
            allowPasswordExtraction: true,
            allowPublicLinks: true,
          },
        },
        userTargetedSharing: {
          value: {
            defaultShareValidityMinutes: 240,
            maximumShareValidityMinutes: 480,
            allowRepeatDownload: true,
            allowRecipientMultiDeviceAccess: true,
          },
        },
        passwordExtraction: {
          value: {
            allowPasswordExtraction: true,
            requireSystemGeneratedPassword: false,
            maximumRetrievalCount: 4,
          },
        },
        publicLinks: {
          value: {
            allowPublicLinks: true,
            maximumPublicLinkValidityMinutes: 120,
            maximumPublicLinkDownloadCount: 4,
          },
        },
        liveTransfer: {
          value: {
            allowLiveTransfer: true,
            allowPeerToPeer: true,
            allowRelay: true,
            allowPeerToPeerToRelayFallback: true,
            allowLiveToStoredFallback: true,
            retainLiveTransferRecords: true,
            allowGroupedOrLargeLiveTransfer: true,
          },
        },
      })
      .expect(201)
      .expect((response) => {
        expect(response.body.bundleVersion).toBe(2);
      });

    const currentPolicy = await request(app.getHttpServer())
      .get('/api/admin/policy')
      .set('Cookie', adminCookies)
      .expect(200);

    expect(currentPolicy.body.defaultConfidentialityLevel).toBe('CONFIDENTIAL');
    const updatedSecret = currentPolicy.body.currentBundles.find(
      (bundle: { levelName: string }) => bundle.levelName === 'SECRET',
    );
    expect(updatedSecret.bundleVersion).toBe(2);

    const secretHistory = await request(app.getHttpServer())
      .get('/api/admin/policy/history/SECRET')
      .set('Cookie', adminCookies)
      .expect(200);

    expect(secretHistory.body[0].bundleVersion).toBe(2);
    expect(secretHistory.body[1].bundleVersion).toBe(1);

    await request(app.getHttpServer())
      .post('/api/admin/policy/publish')
      .set('Cookie', adminCookies)
      .send({
        levelName: 'CONFIDENTIAL',
        lifecycle: {
          value: {
            defaultValidityMinutes: 60,
            maximumValidityMinutes: 30,
            allowNeverExpire: false,
            allowValidityExtensionLater: true,
            allowFutureTrustedDevices: true,
            allowOutwardResharing: true,
          },
        },
        shareAvailability: {
          value: {
            allowOutwardSharing: true,
            restrictToSelfOnly: false,
            allowRecipientResharing: false,
            allowMultipleOutwardShares: true,
            allowUserTargetedSharing: true,
            allowPasswordExtraction: true,
            allowPublicLinks: false,
          },
        },
        userTargetedSharing: {
          value: {
            defaultShareValidityMinutes: 60,
            maximumShareValidityMinutes: 120,
            allowRepeatDownload: true,
            allowRecipientMultiDeviceAccess: true,
          },
        },
        passwordExtraction: {
          value: {
            allowPasswordExtraction: true,
            requireSystemGeneratedPassword: true,
            maximumRetrievalCount: 3,
          },
        },
        publicLinks: {
          value: {
            allowPublicLinks: false,
            maximumPublicLinkValidityMinutes: 15,
            maximumPublicLinkDownloadCount: 2,
          },
        },
        liveTransfer: {
          value: {
            allowLiveTransfer: true,
            allowPeerToPeer: true,
            allowRelay: true,
            allowPeerToPeerToRelayFallback: true,
            allowLiveToStoredFallback: false,
            retainLiveTransferRecords: true,
            allowGroupedOrLargeLiveTransfer: true,
          },
        },
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/admin/policy/restore-defaults')
      .set('Cookie', adminCookies)
      .send({ defaultConfidentialityLevel: 'SECRET' })
      .expect(201);

    const restoredPolicy = await request(app.getHttpServer())
      .get('/api/admin/policy')
      .set('Cookie', adminCookies)
      .expect(200);

    expect(restoredPolicy.body.defaultConfidentialityLevel).toBe('SECRET');
    const restoredSecret = restoredPolicy.body.currentBundles.find(
      (bundle: { levelName: string }) => bundle.levelName === 'SECRET',
    );
    expect(restoredSecret.bundleVersion).toBe(3);
  });

  it('uses the persisted default confidentiality level for new uploads and exposes metadata-only operations summary', async () => {
    const adminCookies = await login('owner', 'admin123456');

    await request(app.getHttpServer())
      .post('/api/admin/policy/publish')
      .set('Cookie', adminCookies)
      .send({
        levelName: 'SECRET',
        defaultConfidentialityLevel: 'CONFIDENTIAL',
        lifecycle: {
          value: {
            defaultValidityMinutes: 300,
            maximumValidityMinutes: 600,
            allowNeverExpire: false,
            allowValidityExtensionLater: true,
            allowFutureTrustedDevices: true,
            allowOutwardResharing: true,
          },
        },
        shareAvailability: {
          value: {
            allowOutwardSharing: true,
            restrictToSelfOnly: false,
            allowRecipientResharing: false,
            allowMultipleOutwardShares: true,
            allowUserTargetedSharing: true,
            allowPasswordExtraction: true,
            allowPublicLinks: true,
          },
        },
        userTargetedSharing: {
          value: {
            defaultShareValidityMinutes: 240,
            maximumShareValidityMinutes: 480,
            allowRepeatDownload: true,
            allowRecipientMultiDeviceAccess: true,
          },
        },
        passwordExtraction: {
          value: {
            allowPasswordExtraction: true,
            requireSystemGeneratedPassword: false,
            maximumRetrievalCount: 4,
          },
        },
        publicLinks: {
          value: {
            allowPublicLinks: true,
            maximumPublicLinkValidityMinutes: 120,
            maximumPublicLinkDownloadCount: 4,
          },
        },
        liveTransfer: {
          value: {
            allowLiveTransfer: true,
            allowPeerToPeer: true,
            allowRelay: true,
            allowPeerToPeerToRelayFallback: true,
            allowLiveToStoredFallback: true,
            retainLiveTransferRecords: true,
            allowGroupedOrLargeLiveTransfer: true,
          },
        },
      })
      .expect(201);

    const invite = await request(app.getHttpServer())
      .post('/api/admin/invites')
      .set('Cookie', adminCookies)
      .send({ expiresInMinutes: 30 })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/registration/register')
      .send({
        inviteCode: invite.body.code,
        username: 'xena',
        password: 'xena-password',
      })
      .expect(201);

    const xena = await prisma.user.findUniqueOrThrow({ where: { username: 'xena' } });

    await request(app.getHttpServer())
      .post('/api/admin/users/approve')
      .set('Cookie', adminCookies)
      .send({ userId: xena.id })
      .expect(201);

    const xenaSessionCookies = await login('xena', 'xena-password');
    const xenaTrustResponse = await request(app.getHttpServer())
      .post('/api/trust/bootstrap-first-device')
      .set('Cookie', xenaSessionCookies)
      .send({
        deviceLabel: 'Xena Browser 1',
        devicePublicIdentity: 'xena-device-1',
        userDomainPublicKey: 'xena-domain-key',
      })
      .expect(201);
    const xenaCookies = mergeCookies(xenaSessionCookies, xenaTrustResponse.get('set-cookie'));

    const prepare = await request(app.getHttpServer())
      .post('/api/uploads/prepare')
      .set('Cookie', xenaCookies)
      .send({
        contentKind: 'SELF_SPACE_TEXT',
        requestedValidityMinutes: 30,
      })
      .expect(201);

    expect(prepare.body.confidentialityLevel).toBe('CONFIDENTIAL');

    const operationsSummary = await request(app.getHttpServer())
      .get('/api/admin/operations/summary')
      .set('Cookie', adminCookies)
      .expect(200);

    expect(operationsSummary.body.users.totalUsers).toBeGreaterThanOrEqual(2);
    expect(operationsSummary.body.invites.activeInvites).toBeGreaterThanOrEqual(0);
    expect(operationsSummary.body.storage.uploadedCiphertextBytes).toBeGreaterThanOrEqual(0);
    expect(operationsSummary.body).not.toHaveProperty('textCiphertextBody');
    expect(operationsSummary.body).not.toHaveProperty('sourceItemsList');
  });
});
