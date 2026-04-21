import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createPrismaClient } from '../src/prisma/prisma-client';

describe('M1 and M2 foundation (e2e)', () => {
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
    await prisma.pairingSession.deleteMany();
    await prisma.trustedDevice.deleteMany({ where: { user: { username: { not: 'owner' } } } });
    await prisma.recoveryCredentialSet.deleteMany({ where: { user: { username: { not: 'owner' } } } });
    await prisma.userDomainWrappingKey.deleteMany({ where: { user: { username: { not: 'owner' } } } });
    await prisma.inviteCode.deleteMany();
    await prisma.user.deleteMany({ where: { username: { not: 'owner' } } });
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
});
