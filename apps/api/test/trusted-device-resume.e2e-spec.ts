import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { webcrypto } from 'crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { POLICY_BUNDLE_DEFAULTS } from '../src/policy/policy-defaults';
import { createPrismaClient } from '../src/prisma/prisma-client';

describe('Trusted browser resume (e2e)', () => {
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
    await prisma.accessGrantSet.deleteMany();
    await prisma.packageFamily.deleteMany();
    await prisma.publicLink.deleteMany();
    await prisma.extractionAccess.deleteMany();
    await prisma.liveTransferRecordProjection.deleteMany();
    await prisma.liveTransferSession.deleteMany();
    await prisma.shareObject.deleteMany();
    await prisma.groupManifest.deleteMany();
    await prisma.uploadPart.deleteMany();
    await prisma.uploadSession.deleteMany();
    await prisma.sourceItem.deleteMany();
    await prisma.recoveryCredentialSet.deleteMany({
      where: { user: { username: { not: 'owner' } } },
    });
    await prisma.userDomainWrappingKey.deleteMany({
      where: { user: { username: { not: 'owner' } } },
    });
    await prisma.pairingSession.deleteMany();
    await prisma.trustedDevice.deleteMany({
      where: { user: { username: { not: 'owner' } } },
    });
    await prisma.inviteCode.deleteMany();
    await prisma.user.deleteMany({ where: { username: { not: 'owner' } } });
    await prisma.policyBundle.deleteMany();
    await prisma.instanceSetting.deleteMany();

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

  async function createApprovedUser(username: string, password: string) {
    const adminCookies = await login('owner', 'admin123456');
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
  }

  async function createDeviceKeyPair() {
    const keyPair = (await webcrypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    )) as CryptoKeyPair;
    const publicIdentity = JSON.stringify(
      await webcrypto.subtle.exportKey('jwk', keyPair.publicKey),
    );

    return {
      keyPair,
      publicIdentity,
    };
  }

  async function signChallenge(privateKey: CryptoKey, challenge: string) {
    const signature = await webcrypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      privateKey,
      new TextEncoder().encode(challenge),
    );

    return Buffer.from(signature).toString('base64url');
  }

  it('resumes trusted browser access with device proof and rejects invalid, expired, and replayed challenges', async () => {
    const username = 'trusted-resume-user';
    const password = 'trusted-resume-pass';
    const { keyPair, publicIdentity } = await createDeviceKeyPair();

    await createApprovedUser(username, password);
    const setupSessionCookies = await login(username, password);

    await request(app.getHttpServer())
      .post('/api/trust/bootstrap-first-device')
      .set('Cookie', setupSessionCookies)
      .send({
        deviceLabel: 'Resume test browser',
        devicePublicIdentity: publicIdentity,
        deviceWrappingPublicKey: 'resume-test-wrapping-key',
        userDomainPublicKey: 'resume-test-user-domain-key',
      })
      .expect(201);

    const freshSessionCookies = await login(username, password);

    await request(app.getHttpServer())
      .get('/api/bootstrap')
      .set('Cookie', freshSessionCookies)
      .expect(200)
      .expect(({ body }) => {
        expect(body.trustState).toBe('untrusted');
      });

    const invalidChallenge = await request(app.getHttpServer())
      .post('/api/trust/resume-challenge')
      .set('Cookie', freshSessionCookies)
      .send({ devicePublicIdentity: publicIdentity })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/trust/resume')
      .set('Cookie', freshSessionCookies)
      .send({
        challengeId: invalidChallenge.body.challengeId,
        signature: Buffer.from('bad-signature').toString('base64url'),
      })
      .expect(403);

    const expiredChallenge = await request(app.getHttpServer())
      .post('/api/trust/resume-challenge')
      .set('Cookie', freshSessionCookies)
      .send({ devicePublicIdentity: publicIdentity })
      .expect(201);
    await prisma.trustedDeviceResumeChallenge.update({
      where: { id: expiredChallenge.body.challengeId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await request(app.getHttpServer())
      .post('/api/trust/resume')
      .set('Cookie', freshSessionCookies)
      .send({
        challengeId: expiredChallenge.body.challengeId,
        signature: await signChallenge(
          keyPair.privateKey,
          expiredChallenge.body.challenge,
        ),
      })
      .expect(400);

    const validChallenge = await request(app.getHttpServer())
      .post('/api/trust/resume-challenge')
      .set('Cookie', freshSessionCookies)
      .send({ devicePublicIdentity: publicIdentity })
      .expect(201);

    const resume = await request(app.getHttpServer())
      .post('/api/trust/resume')
      .set('Cookie', freshSessionCookies)
      .send({
        challengeId: validChallenge.body.challengeId,
        signature: await signChallenge(
          keyPair.privateKey,
          validChallenge.body.challenge,
        ),
      })
      .expect(201);

    expect(resume.body.trustedDeviceId).toBeTruthy();
    expect(
      resume
        .get('set-cookie')
        ?.some((cookie) => cookie.startsWith('liminalis_trusted_device=')),
    ).toBe(true);

    await request(app.getHttpServer())
      .post('/api/trust/resume')
      .set('Cookie', freshSessionCookies)
      .send({
        challengeId: validChallenge.body.challengeId,
        signature: await signChallenge(
          keyPair.privateKey,
          validChallenge.body.challenge,
        ),
      })
      .expect(400);

    await request(app.getHttpServer())
      .get('/api/bootstrap')
      .set('Cookie', mergeCookies(freshSessionCookies, resume.get('set-cookie')))
      .expect(200)
      .expect(({ body }) => {
        expect(body.trustState).toBe('trusted');
      });
  });
});
