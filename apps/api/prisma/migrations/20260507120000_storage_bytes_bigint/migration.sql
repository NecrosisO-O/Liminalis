ALTER TABLE "User" ALTER COLUMN "storageQuotaBytes" TYPE BIGINT;
ALTER TABLE "InstanceSetting" ALTER COLUMN "defaultStorageQuotaBytes" TYPE BIGINT;
ALTER TABLE "UploadPart" ALTER COLUMN "byteSize" TYPE BIGINT;
ALTER TABLE "SourceItem" ALTER COLUMN "storageBytes" TYPE BIGINT;
ALTER TABLE "ActiveTimelineItemProjection" ALTER COLUMN "visibleSizeBytes" TYPE BIGINT;
