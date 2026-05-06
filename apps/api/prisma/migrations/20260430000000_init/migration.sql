-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'REGULAR_USER');

-- CreateEnum
CREATE TYPE "AdmissionState" AS ENUM ('PENDING_APPROVAL', 'APPROVED');

-- CreateEnum
CREATE TYPE "EnablementState" AS ENUM ('ENABLED', 'DISABLED');

-- CreateEnum
CREATE TYPE "DeviceTrustState" AS ENUM ('UNTRUSTED', 'TRUSTED');

-- CreateEnum
CREATE TYPE "PairingSessionState" AS ENUM ('AWAITING_PAIR', 'AWAITING_APPROVAL', 'TRUSTED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ConfidentialityLevel" AS ENUM ('SECRET', 'CONFIDENTIAL', 'TOP_SECRET');

-- CreateEnum
CREATE TYPE "UploadContentKind" AS ENUM ('SINGLE_FILE', 'GROUPED_CONTENT', 'SELF_SPACE_TEXT');

-- CreateEnum
CREATE TYPE "GroupStructureKind" AS ENUM ('MULTI_FILE', 'FOLDER');

-- CreateEnum
CREATE TYPE "UploadSessionPhase" AS ENUM ('CREATED', 'PREPARING', 'UPLOADING', 'FINALIZING', 'COMPLETED', 'ABANDONED', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "SourceItemState" AS ENUM ('ACTIVE', 'INVALIDATED', 'EXPIRED', 'PURGED');

-- CreateEnum
CREATE TYPE "ProtectedObjectType" AS ENUM ('SOURCE_ITEM', 'SHARE_OBJECT');

-- CreateEnum
CREATE TYPE "AccessGrantStatus" AS ENUM ('CURRENT', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "AccessGrantSubjectMode" AS ENUM ('OWNER_DOMAIN', 'OWNER_DEVICE_SNAPSHOT', 'RECIPIENT_DOMAIN', 'RECIPIENT_DEVICE_SNAPSHOT');

-- CreateEnum
CREATE TYPE "PackageFamilyKind" AS ENUM ('OWNER_ORDINARY', 'OWNER_RECOVERY', 'RECIPIENT_ORDINARY', 'RECIPIENT_RECOVERY', 'PASSWORD_EXTRACTION');

-- CreateEnum
CREATE TYPE "RetrievalFamily" AS ENUM ('SOURCE_ITEM_OWNER', 'SHARE_OBJECT_RECIPIENT', 'EXTRACTION_ACCESS');

-- CreateEnum
CREATE TYPE "RetrievalAttemptStatus" AS ENUM ('ISSUED', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED', 'FAILED');

-- CreateEnum
CREATE TYPE "ProjectionSourceType" AS ENUM ('SOURCE_ITEM', 'SHARE_OBJECT');

-- CreateEnum
CREATE TYPE "ShareObjectState" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ShareObjectInactiveReason" AS ENUM ('REVOKED', 'EXPIRED', 'SOURCE_INVALIDATED', 'CONSUMED');

-- CreateEnum
CREATE TYPE "ExtractionAccessState" AS ENUM ('ACTIVE', 'CHALLENGE_REQUIRED', 'EXHAUSTED', 'EXPIRED', 'REVOKED', 'INVALIDATED');

-- CreateEnum
CREATE TYPE "PublicLinkState" AS ENUM ('ACTIVE', 'EXHAUSTED', 'EXPIRED', 'REVOKED', 'INVALIDATED');

-- CreateEnum
CREATE TYPE "LiveTransferSessionState" AS ENUM ('CREATED', 'AWAITING_JOIN', 'AWAITING_CONFIRMATION', 'CONNECTING', 'ACTIVE', 'COMPLETED', 'EXPIRED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LiveTransferTransportState" AS ENUM ('P2P_ATTEMPT', 'RELAY_ATTEMPT', 'P2P_ACTIVE', 'RELAY_ACTIVE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'REGULAR_USER',
    "admissionState" "AdmissionState" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "enablementState" "EnablementState" NOT NULL DEFAULT 'ENABLED',
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "storageQuotaBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InviteCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "consumedById" TEXT,
    "invalidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "idleExpiresAt" TIMESTAMP(3) NOT NULL,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustedDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "trustState" "DeviceTrustState" NOT NULL DEFAULT 'UNTRUSTED',
    "trustEstablishedAt" TIMESTAMP(3),
    "recoveryRequestedAt" TIMESTAMP(3),
    "recoveryEstablishedAt" TIMESTAMP(3),
    "publicIdentityVersion" INTEGER NOT NULL DEFAULT 1,
    "publicIdentityPayload" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrustedDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PairingSession" (
    "id" TEXT NOT NULL,
    "state" "PairingSessionState" NOT NULL DEFAULT 'AWAITING_PAIR',
    "requesterDeviceId" TEXT NOT NULL,
    "approverDeviceId" TEXT,
    "qrToken" TEXT NOT NULL,
    "shortCode" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PairingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecoveryCredentialSet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHashOne" TEXT NOT NULL,
    "codeHashTwo" TEXT NOT NULL,
    "codeHashThree" TEXT NOT NULL,
    "pendingDisplayBlob" TEXT,
    "pendingDisplayUntil" TIMESTAMP(3),
    "rotatedAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecoveryCredentialSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDomainWrappingKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "publicKey" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserDomainWrappingKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyBundle" (
    "id" TEXT NOT NULL,
    "levelName" "ConfidentialityLevel" NOT NULL,
    "bundleVersion" INTEGER NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "updatedByAdminId" TEXT,
    "lifecycle" JSONB NOT NULL,
    "shareAvailability" JSONB NOT NULL,
    "userTargetedSharing" JSONB NOT NULL,
    "passwordExtraction" JSONB NOT NULL,
    "publicLinks" JSONB NOT NULL,
    "liveTransfer" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolicyBundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstanceSetting" (
    "id" TEXT NOT NULL,
    "singletonKey" TEXT NOT NULL,
    "defaultConfidentialityLevel" "ConfidentialityLevel" NOT NULL DEFAULT 'SECRET',
    "defaultStorageQuotaBytes" INTEGER NOT NULL DEFAULT 1073741824,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstanceSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveTransferSession" (
    "id" TEXT NOT NULL,
    "initiatorUserId" TEXT NOT NULL,
    "initiatorDeviceId" TEXT NOT NULL,
    "joinerUserId" TEXT,
    "joinerDeviceId" TEXT,
    "confidentialityLevel" "ConfidentialityLevel" NOT NULL,
    "policyBundleId" TEXT NOT NULL,
    "policySnapshot" JSONB NOT NULL,
    "state" "LiveTransferSessionState" NOT NULL DEFAULT 'CREATED',
    "transportState" "LiveTransferTransportState",
    "sessionCode" TEXT,
    "initiatorConfirmedAt" TIMESTAMP(3),
    "joinerConfirmedAt" TIMESTAMP(3),
    "contentLabel" TEXT NOT NULL,
    "contentKind" "UploadContentKind" NOT NULL,
    "groupedTransfer" BOOLEAN NOT NULL DEFAULT false,
    "relayAllowed" BOOLEAN NOT NULL DEFAULT false,
    "peerToPeerAllowed" BOOLEAN NOT NULL DEFAULT true,
    "peerToPeerToRelayFallback" BOOLEAN NOT NULL DEFAULT false,
    "liveToStoredFallbackAllowed" BOOLEAN NOT NULL DEFAULT false,
    "retainRecord" BOOLEAN NOT NULL DEFAULT false,
    "storedFallbackUploadSessionId" TEXT,
    "failureReason" TEXT,
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveTransferSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveTransferSignalMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "senderDeviceId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "recipientDeviceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveTransferSignalMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveTransferRelayChunk" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "senderDeviceId" TEXT NOT NULL,
    "recipientDeviceId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "checksum" TEXT,
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveTransferRelayChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadSession" (
    "id" TEXT NOT NULL,
    "uploaderUserId" TEXT NOT NULL,
    "contentKind" "UploadContentKind" NOT NULL,
    "groupStructureKind" "GroupStructureKind",
    "confidentialityLevel" "ConfidentialityLevel" NOT NULL,
    "policyBundleId" TEXT NOT NULL,
    "policySnapshot" JSONB NOT NULL,
    "requestedValidityMinutes" INTEGER,
    "resolvedValidityMinutes" INTEGER,
    "burnAfterReadEnabled" BOOLEAN NOT NULL DEFAULT false,
    "phase" "UploadSessionPhase" NOT NULL DEFAULT 'CREATED',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "finalizedSourceItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UploadSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadPart" (
    "id" TEXT NOT NULL,
    "uploadSessionId" TEXT NOT NULL,
    "partNumber" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UploadPart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceItem" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "contentKind" "UploadContentKind" NOT NULL,
    "groupStructureKind" "GroupStructureKind",
    "confidentialityLevel" "ConfidentialityLevel" NOT NULL,
    "state" "SourceItemState" NOT NULL DEFAULT 'ACTIVE',
    "policyBundleId" TEXT NOT NULL,
    "policySnapshot" JSONB NOT NULL,
    "displayName" TEXT,
    "textCiphertextBody" TEXT,
    "storageBinding" JSONB,
    "storageBytes" INTEGER NOT NULL DEFAULT 0,
    "validUntil" TIMESTAMP(3),
    "burnAfterReadEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareObject" (
    "id" TEXT NOT NULL,
    "sourceItemId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "confidentialityLevel" "ConfidentialityLevel" NOT NULL,
    "state" "ShareObjectState" NOT NULL DEFAULT 'ACTIVE',
    "inactiveReason" "ShareObjectInactiveReason",
    "policyBundleId" TEXT NOT NULL,
    "policySnapshot" JSONB NOT NULL,
    "validUntil" TIMESTAMP(3),
    "allowRepeatDownload" BOOLEAN NOT NULL DEFAULT true,
    "allowRecipientMultiDeviceAccess" BOOLEAN NOT NULL DEFAULT true,
    "burnAfterReadEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShareObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractionAccess" (
    "id" TEXT NOT NULL,
    "sourceItemId" TEXT NOT NULL,
    "shareObjectId" TEXT,
    "policyBundleId" TEXT NOT NULL,
    "policySnapshot" JSONB NOT NULL,
    "state" "ExtractionAccessState" NOT NULL DEFAULT 'ACTIVE',
    "entryToken" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "requireSystemGeneratedPassword" BOOLEAN NOT NULL DEFAULT false,
    "configuredRetrievalCount" INTEGER NOT NULL,
    "remainingRetrievalCount" INTEGER NOT NULL,
    "failedPasswordAttempts" INTEGER NOT NULL DEFAULT 0,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtractionAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicLink" (
    "id" TEXT NOT NULL,
    "sourceItemId" TEXT NOT NULL,
    "shareObjectId" TEXT,
    "policyBundleId" TEXT NOT NULL,
    "policySnapshot" JSONB NOT NULL,
    "state" "PublicLinkState" NOT NULL DEFAULT 'ACTIVE',
    "linkToken" TEXT NOT NULL,
    "configuredDownloadCount" INTEGER NOT NULL,
    "remainingDownloadCount" INTEGER NOT NULL,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicLinkDeliveryTicket" (
    "id" TEXT NOT NULL,
    "publicLinkId" TEXT NOT NULL,
    "ticketToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "redeemedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicLinkDeliveryTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupManifest" (
    "id" TEXT NOT NULL,
    "sourceItemId" TEXT NOT NULL,
    "structureKind" "GroupStructureKind" NOT NULL,
    "manifestJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupManifest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageFamily" (
    "id" TEXT NOT NULL,
    "protectedObjectType" "ProtectedObjectType" NOT NULL,
    "protectedObjectId" TEXT NOT NULL,
    "sourceItemId" TEXT,
    "shareObjectId" TEXT,
    "extractionAccessId" TEXT,
    "kind" "PackageFamilyKind" NOT NULL,
    "familyVersion" INTEGER NOT NULL,
    "issueTrigger" TEXT NOT NULL,
    "referenceBlob" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackageFamily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessGrantSet" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "protectedObjectType" "ProtectedObjectType" NOT NULL,
    "sourceItemId" TEXT,
    "shareObjectId" TEXT,
    "status" "AccessGrantStatus" NOT NULL DEFAULT 'CURRENT',
    "grantSubjectMode" "AccessGrantSubjectMode" NOT NULL,
    "subjectUserId" TEXT NOT NULL,
    "snapshotDeviceIds" TEXT[],
    "ordinaryPackageFamilyId" TEXT NOT NULL,
    "recoveryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "recoveryPackageFamilyId" TEXT,
    "confidentialityLevel" "ConfidentialityLevel" NOT NULL,
    "allowFutureTrustedDevices" BOOLEAN NOT NULL DEFAULT false,
    "allowRecipientMultiDeviceAccess" BOOLEAN NOT NULL DEFAULT false,
    "issueTrigger" TEXT NOT NULL,
    "supersedesAccessGrantSetId" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededAt" TIMESTAMP(3),

    CONSTRAINT "AccessGrantSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageReference" (
    "id" TEXT NOT NULL,
    "packageFamilyId" TEXT NOT NULL,
    "packageFamilyKind" "PackageFamilyKind" NOT NULL,
    "protectedObjectType" "ProtectedObjectType" NOT NULL,
    "protectedObjectId" TEXT NOT NULL,
    "eligibleSubjectUserId" TEXT,
    "eligibleSubjectDeviceId" TEXT,
    "packageFamilyVersion" INTEGER NOT NULL,
    "wrappedPayloadReference" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackageReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetrievalAttempt" (
    "id" TEXT NOT NULL,
    "retrievalFamily" "RetrievalFamily" NOT NULL,
    "targetObjectType" "ProtectedObjectType" NOT NULL,
    "targetObjectId" TEXT NOT NULL,
    "sourceItemId" TEXT,
    "shareObjectId" TEXT,
    "extractionAccessId" TEXT,
    "requestingUserId" TEXT,
    "requestingDeviceId" TEXT,
    "status" "RetrievalAttemptStatus" NOT NULL DEFAULT 'ISSUED',
    "attemptScopeKey" TEXT NOT NULL,
    "packageReferenceId" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetrievalAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActiveTimelineItemProjection" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "sourceObjectType" "ProjectionSourceType" NOT NULL,
    "sourceObjectId" TEXT NOT NULL,
    "sourceItemId" TEXT,
    "shareObjectId" TEXT,
    "displayTitle" TEXT,
    "visibleTypeLabel" TEXT NOT NULL,
    "visibleSizeBytes" INTEGER,
    "groupedItemCount" INTEGER,
    "sourceLabel" TEXT NOT NULL,
    "activeStatusLabel" TEXT NOT NULL,
    "confidentialityLevel" "ConfidentialityLevel" NOT NULL,
    "currentRetrievable" BOOLEAN NOT NULL,
    "visibleSummary" TEXT,
    "createdTime" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3),
    "projectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActiveTimelineItemProjection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoryEntryProjection" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "sourceObjectType" "ProjectionSourceType" NOT NULL,
    "sourceObjectId" TEXT NOT NULL,
    "sourceItemId" TEXT,
    "shareObjectId" TEXT,
    "displayTitle" TEXT,
    "visibleTypeLabel" TEXT NOT NULL,
    "sourceLabel" TEXT NOT NULL,
    "confidentialityLevel" "ConfidentialityLevel" NOT NULL,
    "retainedStatus" TEXT NOT NULL,
    "retrievable" BOOLEAN NOT NULL,
    "concreteReason" TEXT,
    "visibleSummary" TEXT,
    "createdTime" TIMESTAMP(3) NOT NULL,
    "statusTime" TIMESTAMP(3),
    "projectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HistoryEntryProjection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchDocumentProjection" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "sourceObjectType" "ProjectionSourceType" NOT NULL,
    "sourceObjectId" TEXT NOT NULL,
    "sourceItemId" TEXT,
    "shareObjectId" TEXT,
    "displayTitle" TEXT,
    "visibleSummary" TEXT,
    "sourceLabel" TEXT NOT NULL,
    "visibleTypeLabel" TEXT NOT NULL,
    "visibleStatusLabel" TEXT NOT NULL,
    "confidentialityLevel" "ConfidentialityLevel" NOT NULL,
    "retrievable" BOOLEAN NOT NULL,
    "projectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchDocumentProjection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveTransferRecordProjection" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "liveTransferSessionId" TEXT NOT NULL,
    "participantLabel" TEXT NOT NULL,
    "sessionOutcome" TEXT NOT NULL,
    "transportSummary" TEXT,
    "contentLabel" TEXT NOT NULL,
    "contentKind" "UploadContentKind" NOT NULL,
    "groupedTransfer" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "projectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveTransferRecordProjection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "InviteCode_code_key" ON "InviteCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "PairingSession_qrToken_key" ON "PairingSession"("qrToken");

-- CreateIndex
CREATE UNIQUE INDEX "PairingSession_shortCode_key" ON "PairingSession"("shortCode");

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryCredentialSet_userId_key" ON "RecoveryCredentialSet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserDomainWrappingKey_userId_version_key" ON "UserDomainWrappingKey"("userId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyBundle_levelName_bundleVersion_key" ON "PolicyBundle"("levelName", "bundleVersion");

-- CreateIndex
CREATE UNIQUE INDEX "InstanceSetting_singletonKey_key" ON "InstanceSetting"("singletonKey");

-- CreateIndex
CREATE UNIQUE INDEX "LiveTransferSession_sessionCode_key" ON "LiveTransferSession"("sessionCode");

-- CreateIndex
CREATE INDEX "LiveTransferSignalMessage_sessionId_recipientDeviceId_readA_idx" ON "LiveTransferSignalMessage"("sessionId", "recipientDeviceId", "readAt");

-- CreateIndex
CREATE INDEX "LiveTransferRelayChunk_sessionId_recipientDeviceId_received_idx" ON "LiveTransferRelayChunk"("sessionId", "recipientDeviceId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LiveTransferRelayChunk_sessionId_senderDeviceId_sequence_key" ON "LiveTransferRelayChunk"("sessionId", "senderDeviceId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "UploadSession_finalizedSourceItemId_key" ON "UploadSession"("finalizedSourceItemId");

-- CreateIndex
CREATE INDEX "UploadSession_uploaderUserId_phase_idx" ON "UploadSession"("uploaderUserId", "phase");

-- CreateIndex
CREATE UNIQUE INDEX "UploadPart_uploadSessionId_partNumber_key" ON "UploadPart"("uploadSessionId", "partNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ExtractionAccess_shareObjectId_key" ON "ExtractionAccess"("shareObjectId");

-- CreateIndex
CREATE UNIQUE INDEX "ExtractionAccess_entryToken_key" ON "ExtractionAccess"("entryToken");

-- CreateIndex
CREATE UNIQUE INDEX "PublicLink_linkToken_key" ON "PublicLink"("linkToken");

-- CreateIndex
CREATE UNIQUE INDEX "PublicLinkDeliveryTicket_ticketToken_key" ON "PublicLinkDeliveryTicket"("ticketToken");

-- CreateIndex
CREATE UNIQUE INDEX "GroupManifest_sourceItemId_key" ON "GroupManifest"("sourceItemId");

-- CreateIndex
CREATE INDEX "PackageFamily_protectedObjectType_protectedObjectId_kind_idx" ON "PackageFamily"("protectedObjectType", "protectedObjectId", "kind");

-- CreateIndex
CREATE INDEX "AccessGrantSet_protectedObjectType_status_idx" ON "AccessGrantSet"("protectedObjectType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AccessGrantSet_sourceItemId_version_key" ON "AccessGrantSet"("sourceItemId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "AccessGrantSet_shareObjectId_version_key" ON "AccessGrantSet"("shareObjectId", "version");

-- CreateIndex
CREATE INDEX "PackageReference_protectedObjectType_protectedObjectId_pack_idx" ON "PackageReference"("protectedObjectType", "protectedObjectId", "packageFamilyKind");

-- CreateIndex
CREATE UNIQUE INDEX "RetrievalAttempt_packageReferenceId_key" ON "RetrievalAttempt"("packageReferenceId");

-- CreateIndex
CREATE INDEX "RetrievalAttempt_sourceItemId_status_idx" ON "RetrievalAttempt"("sourceItemId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RetrievalAttempt_retrievalFamily_targetObjectId_requestingU_key" ON "RetrievalAttempt"("retrievalFamily", "targetObjectId", "requestingUserId", "requestingDeviceId", "attemptScopeKey");

-- CreateIndex
CREATE UNIQUE INDEX "RetrievalAttempt_retrievalFamily_extractionAccessId_attempt_key" ON "RetrievalAttempt"("retrievalFamily", "extractionAccessId", "attemptScopeKey");

-- CreateIndex
CREATE UNIQUE INDEX "ActiveTimelineItemProjection_sourceItemId_key" ON "ActiveTimelineItemProjection"("sourceItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ActiveTimelineItemProjection_shareObjectId_key" ON "ActiveTimelineItemProjection"("shareObjectId");

-- CreateIndex
CREATE UNIQUE INDEX "ActiveTimelineItemProjection_ownerUserId_sourceObjectType_s_key" ON "ActiveTimelineItemProjection"("ownerUserId", "sourceObjectType", "sourceObjectId");

-- CreateIndex
CREATE UNIQUE INDEX "HistoryEntryProjection_sourceItemId_key" ON "HistoryEntryProjection"("sourceItemId");

-- CreateIndex
CREATE UNIQUE INDEX "HistoryEntryProjection_shareObjectId_key" ON "HistoryEntryProjection"("shareObjectId");

-- CreateIndex
CREATE UNIQUE INDEX "HistoryEntryProjection_ownerUserId_sourceObjectType_sourceO_key" ON "HistoryEntryProjection"("ownerUserId", "sourceObjectType", "sourceObjectId");

-- CreateIndex
CREATE UNIQUE INDEX "SearchDocumentProjection_sourceItemId_key" ON "SearchDocumentProjection"("sourceItemId");

-- CreateIndex
CREATE UNIQUE INDEX "SearchDocumentProjection_shareObjectId_key" ON "SearchDocumentProjection"("shareObjectId");

-- CreateIndex
CREATE UNIQUE INDEX "SearchDocumentProjection_ownerUserId_sourceObjectType_sourc_key" ON "SearchDocumentProjection"("ownerUserId", "sourceObjectType", "sourceObjectId");

-- CreateIndex
CREATE UNIQUE INDEX "LiveTransferRecordProjection_ownerUserId_liveTransferSessio_key" ON "LiveTransferRecordProjection"("ownerUserId", "liveTransferSessionId");

-- AddForeignKey
ALTER TABLE "InviteCode" ADD CONSTRAINT "InviteCode_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustedDevice" ADD CONSTRAINT "TrustedDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PairingSession" ADD CONSTRAINT "PairingSession_requesterDeviceId_fkey" FOREIGN KEY ("requesterDeviceId") REFERENCES "TrustedDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PairingSession" ADD CONSTRAINT "PairingSession_approverDeviceId_fkey" FOREIGN KEY ("approverDeviceId") REFERENCES "TrustedDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecoveryCredentialSet" ADD CONSTRAINT "RecoveryCredentialSet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDomainWrappingKey" ADD CONSTRAINT "UserDomainWrappingKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveTransferSession" ADD CONSTRAINT "LiveTransferSession_initiatorUserId_fkey" FOREIGN KEY ("initiatorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveTransferSession" ADD CONSTRAINT "LiveTransferSession_initiatorDeviceId_fkey" FOREIGN KEY ("initiatorDeviceId") REFERENCES "TrustedDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveTransferSession" ADD CONSTRAINT "LiveTransferSession_joinerUserId_fkey" FOREIGN KEY ("joinerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveTransferSession" ADD CONSTRAINT "LiveTransferSession_joinerDeviceId_fkey" FOREIGN KEY ("joinerDeviceId") REFERENCES "TrustedDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveTransferSession" ADD CONSTRAINT "LiveTransferSession_policyBundleId_fkey" FOREIGN KEY ("policyBundleId") REFERENCES "PolicyBundle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveTransferSignalMessage" ADD CONSTRAINT "LiveTransferSignalMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LiveTransferSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveTransferSignalMessage" ADD CONSTRAINT "LiveTransferSignalMessage_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveTransferSignalMessage" ADD CONSTRAINT "LiveTransferSignalMessage_senderDeviceId_fkey" FOREIGN KEY ("senderDeviceId") REFERENCES "TrustedDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveTransferSignalMessage" ADD CONSTRAINT "LiveTransferSignalMessage_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveTransferSignalMessage" ADD CONSTRAINT "LiveTransferSignalMessage_recipientDeviceId_fkey" FOREIGN KEY ("recipientDeviceId") REFERENCES "TrustedDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveTransferRelayChunk" ADD CONSTRAINT "LiveTransferRelayChunk_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LiveTransferSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadSession" ADD CONSTRAINT "UploadSession_uploaderUserId_fkey" FOREIGN KEY ("uploaderUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadSession" ADD CONSTRAINT "UploadSession_policyBundleId_fkey" FOREIGN KEY ("policyBundleId") REFERENCES "PolicyBundle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadSession" ADD CONSTRAINT "UploadSession_finalizedSourceItemId_fkey" FOREIGN KEY ("finalizedSourceItemId") REFERENCES "SourceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadPart" ADD CONSTRAINT "UploadPart_uploadSessionId_fkey" FOREIGN KEY ("uploadSessionId") REFERENCES "UploadSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceItem" ADD CONSTRAINT "SourceItem_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceItem" ADD CONSTRAINT "SourceItem_policyBundleId_fkey" FOREIGN KEY ("policyBundleId") REFERENCES "PolicyBundle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareObject" ADD CONSTRAINT "ShareObject_sourceItemId_fkey" FOREIGN KEY ("sourceItemId") REFERENCES "SourceItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareObject" ADD CONSTRAINT "ShareObject_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareObject" ADD CONSTRAINT "ShareObject_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareObject" ADD CONSTRAINT "ShareObject_policyBundleId_fkey" FOREIGN KEY ("policyBundleId") REFERENCES "PolicyBundle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractionAccess" ADD CONSTRAINT "ExtractionAccess_sourceItemId_fkey" FOREIGN KEY ("sourceItemId") REFERENCES "SourceItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractionAccess" ADD CONSTRAINT "ExtractionAccess_shareObjectId_fkey" FOREIGN KEY ("shareObjectId") REFERENCES "ShareObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractionAccess" ADD CONSTRAINT "ExtractionAccess_policyBundleId_fkey" FOREIGN KEY ("policyBundleId") REFERENCES "PolicyBundle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicLink" ADD CONSTRAINT "PublicLink_sourceItemId_fkey" FOREIGN KEY ("sourceItemId") REFERENCES "SourceItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicLink" ADD CONSTRAINT "PublicLink_shareObjectId_fkey" FOREIGN KEY ("shareObjectId") REFERENCES "ShareObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicLink" ADD CONSTRAINT "PublicLink_policyBundleId_fkey" FOREIGN KEY ("policyBundleId") REFERENCES "PolicyBundle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicLinkDeliveryTicket" ADD CONSTRAINT "PublicLinkDeliveryTicket_publicLinkId_fkey" FOREIGN KEY ("publicLinkId") REFERENCES "PublicLink"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupManifest" ADD CONSTRAINT "GroupManifest_sourceItemId_fkey" FOREIGN KEY ("sourceItemId") REFERENCES "SourceItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageFamily" ADD CONSTRAINT "PackageFamily_sourceItemId_fkey" FOREIGN KEY ("sourceItemId") REFERENCES "SourceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageFamily" ADD CONSTRAINT "PackageFamily_shareObjectId_fkey" FOREIGN KEY ("shareObjectId") REFERENCES "ShareObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageFamily" ADD CONSTRAINT "PackageFamily_extractionAccessId_fkey" FOREIGN KEY ("extractionAccessId") REFERENCES "ExtractionAccess"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessGrantSet" ADD CONSTRAINT "AccessGrantSet_sourceItemId_fkey" FOREIGN KEY ("sourceItemId") REFERENCES "SourceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessGrantSet" ADD CONSTRAINT "AccessGrantSet_shareObjectId_fkey" FOREIGN KEY ("shareObjectId") REFERENCES "ShareObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessGrantSet" ADD CONSTRAINT "AccessGrantSet_ordinaryPackageFamilyId_fkey" FOREIGN KEY ("ordinaryPackageFamilyId") REFERENCES "PackageFamily"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessGrantSet" ADD CONSTRAINT "AccessGrantSet_recoveryPackageFamilyId_fkey" FOREIGN KEY ("recoveryPackageFamilyId") REFERENCES "PackageFamily"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageReference" ADD CONSTRAINT "PackageReference_packageFamilyId_fkey" FOREIGN KEY ("packageFamilyId") REFERENCES "PackageFamily"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetrievalAttempt" ADD CONSTRAINT "RetrievalAttempt_sourceItemId_fkey" FOREIGN KEY ("sourceItemId") REFERENCES "SourceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetrievalAttempt" ADD CONSTRAINT "RetrievalAttempt_shareObjectId_fkey" FOREIGN KEY ("shareObjectId") REFERENCES "ShareObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetrievalAttempt" ADD CONSTRAINT "RetrievalAttempt_extractionAccessId_fkey" FOREIGN KEY ("extractionAccessId") REFERENCES "ExtractionAccess"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetrievalAttempt" ADD CONSTRAINT "RetrievalAttempt_requestingUserId_fkey" FOREIGN KEY ("requestingUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetrievalAttempt" ADD CONSTRAINT "RetrievalAttempt_requestingDeviceId_fkey" FOREIGN KEY ("requestingDeviceId") REFERENCES "TrustedDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetrievalAttempt" ADD CONSTRAINT "RetrievalAttempt_packageReferenceId_fkey" FOREIGN KEY ("packageReferenceId") REFERENCES "PackageReference"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiveTimelineItemProjection" ADD CONSTRAINT "ActiveTimelineItemProjection_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiveTimelineItemProjection" ADD CONSTRAINT "ActiveTimelineItemProjection_sourceItemId_fkey" FOREIGN KEY ("sourceItemId") REFERENCES "SourceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiveTimelineItemProjection" ADD CONSTRAINT "ActiveTimelineItemProjection_shareObjectId_fkey" FOREIGN KEY ("shareObjectId") REFERENCES "ShareObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoryEntryProjection" ADD CONSTRAINT "HistoryEntryProjection_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoryEntryProjection" ADD CONSTRAINT "HistoryEntryProjection_sourceItemId_fkey" FOREIGN KEY ("sourceItemId") REFERENCES "SourceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoryEntryProjection" ADD CONSTRAINT "HistoryEntryProjection_shareObjectId_fkey" FOREIGN KEY ("shareObjectId") REFERENCES "ShareObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchDocumentProjection" ADD CONSTRAINT "SearchDocumentProjection_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchDocumentProjection" ADD CONSTRAINT "SearchDocumentProjection_sourceItemId_fkey" FOREIGN KEY ("sourceItemId") REFERENCES "SourceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchDocumentProjection" ADD CONSTRAINT "SearchDocumentProjection_shareObjectId_fkey" FOREIGN KEY ("shareObjectId") REFERENCES "ShareObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveTransferRecordProjection" ADD CONSTRAINT "LiveTransferRecordProjection_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveTransferRecordProjection" ADD CONSTRAINT "LiveTransferRecordProjection_liveTransferSessionId_fkey" FOREIGN KEY ("liveTransferSessionId") REFERENCES "LiveTransferSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
