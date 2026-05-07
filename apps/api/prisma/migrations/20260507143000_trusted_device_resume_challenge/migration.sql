CREATE TABLE "TrustedDeviceResumeChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "trustedDeviceId" TEXT NOT NULL,
    "challenge" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustedDeviceResumeChallenge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrustedDeviceResumeChallenge_challenge_key" ON "TrustedDeviceResumeChallenge"("challenge");
CREATE INDEX "TrustedDeviceResumeChallenge_userId_sessionId_idx" ON "TrustedDeviceResumeChallenge"("userId", "sessionId");
CREATE INDEX "TrustedDeviceResumeChallenge_trustedDeviceId_idx" ON "TrustedDeviceResumeChallenge"("trustedDeviceId");
CREATE INDEX "TrustedDeviceResumeChallenge_expiresAt_idx" ON "TrustedDeviceResumeChallenge"("expiresAt");

ALTER TABLE "TrustedDeviceResumeChallenge" ADD CONSTRAINT "TrustedDeviceResumeChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrustedDeviceResumeChallenge" ADD CONSTRAINT "TrustedDeviceResumeChallenge_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrustedDeviceResumeChallenge" ADD CONSTRAINT "TrustedDeviceResumeChallenge_trustedDeviceId_fkey" FOREIGN KEY ("trustedDeviceId") REFERENCES "TrustedDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
