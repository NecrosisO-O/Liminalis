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
    await prisma.activeTimelineItemProjection.deleteMany();
    await prisma.historyEntryProjection.deleteMany();
    await prisma.searchDocumentProjection.deleteMany();
    await prisma.accessGrantSet.deleteMany();
    await prisma.packageFamily.deleteMany();
    await prisma.shareObject.deleteMany();
    await prisma.groupManifest.deleteMany();
    await prisma.uploadPart.deleteMany();
    await prisma.uploadSession.deleteMany();
    await prisma.sourceItem.deleteMany();
    await prisma.policyBundle.deleteMany();
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
});
