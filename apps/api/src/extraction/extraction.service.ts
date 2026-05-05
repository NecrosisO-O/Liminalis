import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { Readable } from 'stream';
import { Prisma } from '../../generated/prisma/index.js';
import {
  ExtractionAccessState,
  PackageFamilyKind,
  ProtectedObjectType,
  RetrievalAttemptStatus,
  RetrievalFamily,
  SourceItemState,
  UploadContentKind,
} from '../../generated/prisma/index.js';
import { PolicyService } from '../policy/policy.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateExtractionDto } from './dto/create-extraction.dto';
import { SubmitExtractionPasswordDto } from './dto/submit-extraction-password.dto';

@Injectable()
export class ExtractionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policyService: PolicyService,
    private readonly storageService: StorageService,
  ) {}

  async createExtraction(ownerUserId: string, input: CreateExtractionDto) {
    const sourceItem = await this.prisma.sourceItem.findFirst({
      where: {
        id: input.sourceItemId,
        ownerUserId,
      },
      include: { ownerUser: true },
    });

    if (!sourceItem) {
      throw new NotFoundException('Source item not found');
    }

    if (sourceItem.state !== SourceItemState.ACTIVE) {
      throw new BadRequestException(
        'Source item is not eligible for extraction',
      );
    }

    if (sourceItem.validUntil && sourceItem.validUntil < new Date()) {
      await this.prisma.sourceItem.update({
        where: { id: sourceItem.id },
        data: { state: SourceItemState.EXPIRED },
      });
      throw new BadRequestException('Source item expired');
    }

    if (sourceItem.contentKind === UploadContentKind.SELF_SPACE_TEXT) {
      throw new BadRequestException(
        'Text items cannot be extracted outward in v1',
      );
    }

    const decision = await this.policyService.evaluateExtractionCreation({
      confidentialityLevel: sourceItem.confidentialityLevel,
      requestedValidityMinutes: input.requestedValidityMinutes ?? null,
      requestedRetrievalCount: input.requestedRetrievalCount ?? null,
    });

    const password = this.resolvePassword(
      input.password,
      decision.requireSystemGeneratedPassword,
    );
    const passwordHash = await argon2.hash(password);
    const candidateValidUntil = decision.resolvedValidityMinutes
      ? new Date(Date.now() + decision.resolvedValidityMinutes * 60_000)
      : null;

    const extraction = await this.prisma.$transaction(async (tx) => {
      const created = await tx.extractionAccess.create({
        data: {
          sourceItemId: sourceItem.id,
          policyBundleId: decision.policyBundle.id,
          policySnapshot: decision.snapshotFieldsToPersist,
          state: ExtractionAccessState.ACTIVE,
          entryToken: crypto.randomUUID(),
          passwordHash,
          requireSystemGeneratedPassword:
            decision.requireSystemGeneratedPassword,
          configuredRetrievalCount: decision.resolvedRetrievalCount,
          remainingRetrievalCount: decision.resolvedRetrievalCount,
          validUntil: this.clampValidUntil(
            candidateValidUntil,
            sourceItem.validUntil,
          ),
        },
      });

      await tx.packageFamily.create({
        data: {
          protectedObjectType: ProtectedObjectType.SOURCE_ITEM,
          protectedObjectId: sourceItem.id,
          sourceItemId: sourceItem.id,
          extractionAccessId: created.id,
          kind: PackageFamilyKind.PASSWORD_EXTRACTION,
          familyVersion: 1,
          issueTrigger: 'extraction_created',
          referenceBlob: (input.packageReference ?? {
            packageFamily: 'legacy_password_extraction',
            sourceItemId: sourceItem.id,
            extractionAccessId: created.id,
          }) as Prisma.InputJsonValue,
        },
      });

      return created;
    });

    return {
      extractionAccessId: extraction.id,
      entryToken: extraction.entryToken,
      password,
      remainingRetrievalCount: extraction.remainingRetrievalCount,
      validUntil: extraction.validUntil,
      requireSystemGeneratedPassword: extraction.requireSystemGeneratedPassword,
      packageReference: input.packageReference ?? null,
    };
  }

  async getExtractionEntry(entryToken: string) {
    const extraction = await this.prisma.extractionAccess.findUnique({
      where: { entryToken },
      select: { id: true },
    });

    if (!extraction) {
      throw new NotFoundException('Extraction access not found');
    }

    const refreshed = await this.refreshExtractionState(extraction.id);

    return {
      extractionAccessId: refreshed.id,
      state: refreshed.state,
      requiresCaptcha:
        refreshed.state === ExtractionAccessState.CHALLENGE_REQUIRED,
      remainingRetrievalCount: refreshed.remainingRetrievalCount,
      validUntil: refreshed.validUntil,
      metadata: null,
    };
  }

  async submitPassword(
    entryToken: string,
    attemptScopeKey: string,
    input: SubmitExtractionPasswordDto,
  ) {
    const extraction = await this.prisma.extractionAccess.findUnique({
      where: { entryToken },
      select: { id: true },
    });

    if (!extraction) {
      throw new NotFoundException('Extraction access not found');
    }

    const refreshed = await this.refreshExtractionState(extraction.id);

    if (
      refreshed.state === ExtractionAccessState.CHALLENGE_REQUIRED &&
      !input.captchaSatisfied
    ) {
      throw new BadRequestException('Captcha required');
    }

    if (
      refreshed.state !== ExtractionAccessState.ACTIVE &&
      refreshed.state !== ExtractionAccessState.CHALLENGE_REQUIRED
    ) {
      throw new BadRequestException('Extraction access is not retrievable');
    }

    const passwordOk = await argon2
      .verify(refreshed.passwordHash, input.password)
      .catch(() => false);
    if (!passwordOk) {
      const failedAttempts = refreshed.failedPasswordAttempts + 1;

      await this.prisma.extractionAccess.update({
        where: { id: refreshed.id },
        data: {
          failedPasswordAttempts: failedAttempts,
          state: ExtractionAccessState.CHALLENGE_REQUIRED,
        },
      });

      throw new ForbiddenException('Invalid extraction password');
    }

    const packageFamily = refreshed.packageFamilies[0];
    if (!packageFamily) {
      throw new BadRequestException('Extraction package family not found');
    }

    const attempt = await this.prisma.retrievalAttempt.upsert({
      where: {
        retrievalFamily_extractionAccessId_attemptScopeKey: {
          retrievalFamily: RetrievalFamily.EXTRACTION_ACCESS,
          extractionAccessId: refreshed.id,
          attemptScopeKey,
        },
      },
      update: {
        status: RetrievalAttemptStatus.IN_PROGRESS,
      },
      create: {
        retrievalFamily: RetrievalFamily.EXTRACTION_ACCESS,
        targetObjectType: ProtectedObjectType.SOURCE_ITEM,
        targetObjectId: refreshed.sourceItemId,
        sourceItemId: refreshed.sourceItemId,
        extractionAccessId: refreshed.id,
        status: RetrievalAttemptStatus.IN_PROGRESS,
        attemptScopeKey,
      },
      include: { packageReference: true },
    });

    let packageReference = attempt.packageReference;

    if (!packageReference) {
      packageReference = await this.prisma.packageReference.create({
        data: {
          packageFamilyId: packageFamily.id,
          packageFamilyKind: PackageFamilyKind.PASSWORD_EXTRACTION,
          protectedObjectType: ProtectedObjectType.SOURCE_ITEM,
          protectedObjectId: refreshed.sourceItemId,
          packageFamilyVersion: packageFamily.familyVersion,
          wrappedPayloadReference:
            packageFamily.referenceBlob as Prisma.InputJsonValue,
          expiresAt: new Date(Date.now() + 10 * 60_000),
          retrievalAttempt: {
            connect: { id: attempt.id },
          },
        },
      });
    }

    await this.prisma.extractionAccess.update({
      where: { id: refreshed.id },
      data: {
        failedPasswordAttempts: 0,
        state: ExtractionAccessState.ACTIVE,
      },
    });

    return {
      retrievalAttemptId: attempt.id,
      extractionAccessId: refreshed.id,
      packageReferenceId: packageReference.id,
      packageFamilyKind: packageReference.packageFamilyKind,
      wrappedPayloadReference: packageReference.wrappedPayloadReference,
      sourceItemId: refreshed.sourceItemId,
      storageBinding: refreshed.sourceItem.storageBinding,
      encryptedMetadata: refreshed.sourceItem.encryptedMetadata,
      contentCryptoMetadata: refreshed.sourceItem.contentCryptoMetadata,
      textCiphertextBody: refreshed.sourceItem.textCiphertextBody,
      contentKind: refreshed.sourceItem.contentKind,
      metadata: {
        displayTitle:
          refreshed.sourceItem.displayName ??
          this.fallbackTitle(refreshed.sourceItem.contentKind),
        senderUsername: refreshed.sourceItem.ownerUser.username,
        confidentialityLevel: refreshed.sourceItem.confidentialityLevel,
        contentKind: refreshed.sourceItem.contentKind,
      },
      expiresAt: packageReference.expiresAt,
      remainingRetrievalCount: refreshed.remainingRetrievalCount,
    };
  }

  async completeExtractionRetrieval(
    retrievalAttemptId: string,
    success: boolean,
  ) {
    const attempt = await this.prisma.retrievalAttempt.findUnique({
      where: { id: retrievalAttemptId },
      include: {
        extractionAccess: true,
      },
    });

    if (
      !attempt ||
      attempt.retrievalFamily !== RetrievalFamily.EXTRACTION_ACCESS ||
      !attempt.extractionAccess
    ) {
      throw new NotFoundException('Retrieval attempt not found');
    }

    const extractionAccess = attempt.extractionAccess;

    if (attempt.status === RetrievalAttemptStatus.COMPLETED) {
      return {
        retrievalAttemptId: attempt.id,
        status: attempt.status,
        extractionState: extractionAccess.state,
        remainingRetrievalCount: extractionAccess.remainingRetrievalCount,
      };
    }

    if (!success) {
      const failed = await this.prisma.retrievalAttempt.update({
        where: { id: attempt.id },
        data: { status: RetrievalAttemptStatus.FAILED },
      });

      return {
        retrievalAttemptId: failed.id,
        status: failed.status,
        extractionState: extractionAccess.state,
        remainingRetrievalCount: extractionAccess.remainingRetrievalCount,
      };
    }

    const completed = await this.prisma.$transaction(async (tx) => {
      const updatedAttempt = await tx.retrievalAttempt.update({
        where: { id: attempt.id },
        data: {
          status: RetrievalAttemptStatus.COMPLETED,
          completedAt: new Date(),
        },
      });

      const remaining = Math.max(
        0,
        extractionAccess.remainingRetrievalCount - 1,
      );
      const extractionState =
        remaining === 0
          ? ExtractionAccessState.EXHAUSTED
          : ExtractionAccessState.ACTIVE;

      const updatedExtraction = await tx.extractionAccess.update({
        where: { id: extractionAccess.id },
        data: {
          remainingRetrievalCount: remaining,
          state: extractionState,
        },
      });

      return { updatedAttempt, updatedExtraction };
    });

    return {
      retrievalAttemptId: completed.updatedAttempt.id,
      status: completed.updatedAttempt.status,
      extractionState: completed.updatedExtraction.state,
      remainingRetrievalCount:
        completed.updatedExtraction.remainingRetrievalCount,
    };
  }

  async createDownloadStreamForAttempt(retrievalAttemptId: string) {
    const attempt = await this.prisma.retrievalAttempt.findUnique({
      where: { id: retrievalAttemptId },
      include: {
        extractionAccess: true,
        sourceItem: true,
      },
    });

    if (
      !attempt ||
      attempt.retrievalFamily !== RetrievalFamily.EXTRACTION_ACCESS ||
      !attempt.extractionAccess
    ) {
      throw new NotFoundException('Retrieval attempt not found');
    }

    if (
      attempt.status !== RetrievalAttemptStatus.IN_PROGRESS &&
      attempt.status !== RetrievalAttemptStatus.ISSUED
    ) {
      throw new BadRequestException('Retrieval attempt is not downloadable');
    }

    const refreshed = await this.refreshExtractionState(
      attempt.extractionAccess.id,
    );
    if (
      refreshed.state !== ExtractionAccessState.ACTIVE &&
      refreshed.state !== ExtractionAccessState.CHALLENGE_REQUIRED
    ) {
      throw new BadRequestException('Extraction access is not retrievable');
    }

    const sourceItem = attempt.sourceItem ?? refreshed.sourceItem;
    if (!sourceItem || sourceItem.id !== refreshed.sourceItemId) {
      throw new NotFoundException('Source item not found');
    }

    if (sourceItem.state !== SourceItemState.ACTIVE) {
      throw new BadRequestException('Source item is not retrievable');
    }

    if (sourceItem.validUntil && sourceItem.validUntil < new Date()) {
      await this.prisma.sourceItem.update({
        where: { id: sourceItem.id },
        data: { state: SourceItemState.EXPIRED },
      });
      throw new BadRequestException('Source item expired');
    }

    const parts = this.extractStorageParts(sourceItem.storageBinding);
    const contentLength = parts.reduce((sum, part) => sum + part.byteSize, 0);
    const stream = Readable.from(
      this.readParts(parts.map((part) => part.storageKey)),
    );

    return {
      stream,
      contentLength,
      fileName:
        sourceItem.displayName ?? this.fallbackTitle(sourceItem.contentKind),
    };
  }

  private resolvePassword(
    inputPassword: string | undefined,
    requireSystemGeneratedPassword: boolean,
  ) {
    if (requireSystemGeneratedPassword || !inputPassword) {
      return this.generateSystemPassword();
    }

    return inputPassword;
  }

  private generateSystemPassword() {
    const base = `${crypto.randomUUID()}${crypto.randomUUID()}Aa1!`;
    return base.replace(/-/g, '!').slice(0, 32);
  }

  private async refreshExtractionState(extractionAccessId: string) {
    const extraction = await this.prisma.extractionAccess.findUniqueOrThrow({
      where: { id: extractionAccessId },
      include: {
        sourceItem: {
          include: { ownerUser: true },
        },
        packageFamilies: {
          where: { kind: PackageFamilyKind.PASSWORD_EXTRACTION },
          orderBy: { familyVersion: 'desc' },
        },
      },
    });

    let nextState = extraction.state;

    if (extraction.sourceItem.state !== SourceItemState.ACTIVE) {
      nextState = ExtractionAccessState.INVALIDATED;
    } else if (
      extraction.sourceItem.validUntil &&
      extraction.sourceItem.validUntil < new Date()
    ) {
      nextState = ExtractionAccessState.INVALIDATED;
    } else if (extraction.validUntil && extraction.validUntil < new Date()) {
      nextState = ExtractionAccessState.EXPIRED;
    } else if (extraction.remainingRetrievalCount <= 0) {
      nextState = ExtractionAccessState.EXHAUSTED;
    }

    if (nextState !== extraction.state) {
      return this.prisma.extractionAccess.update({
        where: { id: extraction.id },
        data: { state: nextState },
        include: {
          sourceItem: {
            include: { ownerUser: true },
          },
          packageFamilies: {
            where: { kind: PackageFamilyKind.PASSWORD_EXTRACTION },
            orderBy: { familyVersion: 'desc' },
          },
        },
      });
    }

    return extraction;
  }

  private clampValidUntil(
    candidate: Date | null,
    sourceValidUntil: Date | null,
  ) {
    if (!candidate) {
      return sourceValidUntil;
    }

    if (!sourceValidUntil) {
      return candidate;
    }

    return candidate < sourceValidUntil ? candidate : sourceValidUntil;
  }

  private fallbackTitle(contentKind: string) {
    if (contentKind === 'GROUPED_CONTENT') {
      return 'grouped item';
    }

    return 'file item';
  }

  private extractStorageParts(storageBinding: unknown) {
    if (
      !storageBinding ||
      typeof storageBinding !== 'object' ||
      !('parts' in storageBinding)
    ) {
      throw new BadRequestException('Source item has no stored file bytes');
    }

    const parts = (storageBinding as { parts?: unknown }).parts;
    if (!Array.isArray(parts) || parts.length === 0) {
      throw new BadRequestException('Source item has no stored file bytes');
    }

    return parts.map((part) => {
      if (
        !part ||
        typeof part !== 'object' ||
        typeof (part as { storageKey?: unknown }).storageKey !== 'string' ||
        typeof (part as { byteSize?: unknown }).byteSize !== 'number'
      ) {
        throw new BadRequestException('Stored file binding is invalid');
      }

      return {
        storageKey: (part as { storageKey: string }).storageKey,
        byteSize: (part as { byteSize: number }).byteSize,
      };
    });
  }

  private async *readParts(storageKeys: string[]) {
    for (const storageKey of storageKeys) {
      const stream = this.storageService.createReadStream(storageKey);
      for await (const chunk of stream) {
        yield chunk;
      }
    }
  }
}
