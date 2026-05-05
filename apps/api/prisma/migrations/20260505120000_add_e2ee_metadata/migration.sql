ALTER TABLE "TrustedDevice" ADD COLUMN "deviceWrappingPublicKey" TEXT;

ALTER TABLE "PairingSession" ADD COLUMN "approvalPackage" JSONB;

ALTER TABLE "SourceItem" ADD COLUMN "cryptoVersion" TEXT;
ALTER TABLE "SourceItem" ADD COLUMN "encryptedMetadata" JSONB;
ALTER TABLE "SourceItem" ADD COLUMN "contentCryptoMetadata" JSONB;

ALTER TABLE "ActiveTimelineItemProjection" ADD COLUMN "encryptedMetadata" JSONB;
ALTER TABLE "HistoryEntryProjection" ADD COLUMN "encryptedMetadata" JSONB;
ALTER TABLE "PublicLink" ADD COLUMN "packageReference" JSONB;
