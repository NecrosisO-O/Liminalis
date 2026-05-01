-- Store the trusted device that created a self-space item so timeline can
-- distinguish current-device sends from same-account sends on other devices.
ALTER TABLE "UploadSession" ADD COLUMN "uploaderTrustedDeviceId" TEXT;
ALTER TABLE "SourceItem" ADD COLUMN "createdByTrustedDeviceId" TEXT;

CREATE INDEX "UploadSession_uploaderTrustedDeviceId_idx" ON "UploadSession"("uploaderTrustedDeviceId");
CREATE INDEX "SourceItem_createdByTrustedDeviceId_idx" ON "SourceItem"("createdByTrustedDeviceId");

ALTER TABLE "UploadSession"
  ADD CONSTRAINT "UploadSession_uploaderTrustedDeviceId_fkey"
  FOREIGN KEY ("uploaderTrustedDeviceId") REFERENCES "TrustedDevice"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SourceItem"
  ADD CONSTRAINT "SourceItem_createdByTrustedDeviceId_fkey"
  FOREIGN KEY ("createdByTrustedDeviceId") REFERENCES "TrustedDevice"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
