import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { Prisma } from '../../generated/prisma/index.js';
import {
  ExtractionAccessState,
  PackageFamilyKind,
  ProtectedObjectType,
  RetrievalAttemptStatus,
  RetrievalFamily,
  ShareObjectState,
} from '../../generated/prisma/index.js';
import { PolicyService } from '../policy/policy.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExtractionDto } from './dto/create-extraction.dto';
import { SubmitExtractionPasswordDto } from './dto/submit-extraction-password.dto';

@Injectable()
export class ExtractionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policyService: PolicyService,
  ) {}

  async createExtraction(ownerUserId: string, input: CreateExtractionDto) {
    const share = await this.prisma.shareObject.findFirst({
      where: {
        id: input.shareObjectId,
        ownerUserId,
      },
    });

    if (!share) {
      throw new NotFoundException('Share object not found');
    }

    if (share.state !== ShareObjectState.ACTIVE) {
      throw new BadRequestException('Share object is not eligible for extraction');
    }

    if (await this.prisma.extractionAccess.findUnique({ where: { shareObjectId: share.id } })) {
      throw new BadRequestException('Extraction access already exists for this share');
    }

    const decision = await this.policyService.evaluateExtractionCreation({
      confidentialityLevel: share.confidentialityLevel,
      requestedValidityMinutes: input.requestedValidityMinutes ?? null,
      requestedRetrievalCount: input.requestedRetrievalCount ?? null,
    });

    const password = this.resolvePassword(input.password, decision.requireSystemGeneratedPassword);
    const passwordHash = await argon2.hash(password);

    const extraction = await this.prisma.$transaction(async (tx) => {
      const created = await tx.extractionAccess.create({
        data: {
          shareObjectId: share.id,
          policyBundleId: decision.policyBundle.id,
          policySnapshot: decision.snapshotFieldsToPersist as Prisma.InputJsonValue,
          state: ExtractionAccessState.ACTIVE,
          entryToken: crypto.randomUUID(),
          passwordHash,
          requireSystemGeneratedPassword: decision.requireSystemGeneratedPassword,
          configuredRetrievalCount: decision.resolvedRetrievalCount,
          remainingRetrievalCount: decision.resolvedRetrievalCount,
          validUntil: decision.resolvedValidityMinutes
            ? new Date(Date.now() + decision.resolvedValidityMinutes * 60_000)
            : share.validUntil,
        },
      });

      await tx.packageFamily.create({
        data: {
          protectedObjectType: ProtectedObjectType.SHARE_OBJECT,
          protectedObjectId: share.id,
          shareObjectId: share.id,
          extractionAccessId: created.id,
          kind: PackageFamilyKind.PASSWORD_EXTRACTION,
          familyVersion: 1,
          issueTrigger: 'extraction_created',
          referenceBlob: {
            packageFamily: 'password_extraction',
            shareObjectId: share.id,
            extractionAccessId: created.id,
          },
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
    };
  }

  async getExtractionEntry(entryToken: string) {
    const extraction = await this.prisma.extractionAccess.findUnique({
      where: { entryToken },
      include: {
        shareObject: {
          include: {
            ownerUser: true,
            sourceItem: true,
          },
        },
      },
    });

    if (!extraction) {
      throw new NotFoundException('Extraction access not found');
    }

    const refreshed = await this.refreshExtractionState(extraction.id);

    return {
      extractionAccessId: refreshed.id,
      state: refreshed.state,
      requiresCaptcha: refreshed.state === ExtractionAccessState.CHALLENGE_REQUIRED,
      remainingRetrievalCount: refreshed.remainingRetrievalCount,
      validUntil: refreshed.validUntil,
      metadata:
        refreshed.state === ExtractionAccessState.ACTIVE ||
        refreshed.state === ExtractionAccessState.CHALLENGE_REQUIRED
          ? {
              displayTitle:
                refreshed.shareObject.sourceItem.displayName ??
                this.fallbackTitle(refreshed.shareObject.sourceItem.contentKind),
              senderUsername: refreshed.shareObject.ownerUser.username,
              confidentialityLevel: refreshed.shareObject.confidentialityLevel,
              contentKind: refreshed.shareObject.sourceItem.contentKind,
            }
          : null,
    };
  }

  async submitPassword(
    entryToken: string,
    attemptScopeKey: string,
    input: SubmitExtractionPasswordDto,
  ) {
    const extraction = await this.prisma.extractionAccess.findUnique({
      where: { entryToken },
      include: {
        shareObject: {
          include: {
            sourceItem: true,
          },
        },
        packageFamilies: {
          where: { kind: PackageFamilyKind.PASSWORD_EXTRACTION },
          orderBy: { familyVersion: 'desc' },
        },
      },
    });

    if (!extraction) {
      throw new NotFoundException('Extraction access not found');
    }

    const refreshed = await this.refreshExtractionState(extraction.id);

    if (refreshed.state === ExtractionAccessState.CHALLENGE_REQUIRED && !input.captchaSatisfied) {
      throw new BadRequestException('Captcha required');
    }

    if (refreshed.state === ExtractionAccessState.CHALLENGE_REQUIRED && input.captchaSatisfied) {
      await this.prisma.extractionAccess.update({
        where: { id: refreshed.id },
        data: { state: ExtractionAccessState.ACTIVE },
      });
    }

    if (refreshed.state !== ExtractionAccessState.ACTIVE && refreshed.state !== ExtractionAccessState.CHALLENGE_REQUIRED) {
      throw new BadRequestException('Extraction access is not retrievable');
    }

    const passwordOk = await argon2.verify(refreshed.passwordHash, input.password).catch(() => false);
    if (!passwordOk) {
      const failedAttempts = refreshed.failedPasswordAttempts + 1;
      const nextState = failedAttempts >= 1 ? ExtractionAccessState.CHALLENGE_REQUIRED : refreshed.state;

      await this.prisma.extractionAccess.update({
        where: { id: refreshed.id },
        data: {
          failedPasswordAttempts: failedAttempts,
          state: nextState,
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
        targetObjectType: ProtectedObjectType.SHARE_OBJECT,
        targetObjectId: refreshed.shareObjectId,
        shareObjectId: refreshed.shareObjectId,
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
          protectedObjectType: ProtectedObjectType.SHARE_OBJECT,
          protectedObjectId: refreshed.shareObjectId,
          packageFamilyVersion: packageFamily.familyVersion,
          wrappedPayloadReference: packageFamily.referenceBlob as Prisma.InputJsonValue,
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
      sourceItemId: refreshed.shareObject.sourceItemId,
      textCiphertextBody: refreshed.shareObject.sourceItem.textCiphertextBody,
      contentKind: refreshed.shareObject.sourceItem.contentKind,
      expiresAt: packageReference.expiresAt,
      remainingRetrievalCount: refreshed.remainingRetrievalCount,
    };
  }

  async completeExtractionRetrieval(retrievalAttemptId: string, success: boolean) {
    const attempt = await this.prisma.retrievalAttempt.findUnique({
      where: { id: retrievalAttemptId },
      include: {
        extractionAccess: true,
      },
    });

    if (!attempt || attempt.retrievalFamily !== RetrievalFamily.EXTRACTION_ACCESS || !attempt.extractionAccess) {
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

      const remaining = Math.max(0, extractionAccess.remainingRetrievalCount - 1);
      const extractionState = remaining === 0 ? ExtractionAccessState.EXHAUSTED : ExtractionAccessState.ACTIVE;

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
      remainingRetrievalCount: completed.updatedExtraction.remainingRetrievalCount,
    };
  }

  private resolvePassword(inputPassword: string | undefined, requireSystemGeneratedPassword: boolean) {
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
        shareObject: {
          include: {
            ownerUser: true,
            sourceItem: true,
          },
        },
        packageFamilies: {
          where: { kind: PackageFamilyKind.PASSWORD_EXTRACTION },
          orderBy: { familyVersion: 'desc' },
        },
      },
    });

    let nextState = extraction.state;

    if (extraction.shareObject.state !== ShareObjectState.ACTIVE) {
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
          shareObject: {
            include: {
              ownerUser: true,
              sourceItem: true,
            },
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

  private fallbackTitle(contentKind: string) {
    if (contentKind === 'SELF_SPACE_TEXT') {
      return 'text item';
    }

    if (contentKind === 'GROUPED_CONTENT') {
      return 'grouped item';
    }

    return 'file item';
  }
}
