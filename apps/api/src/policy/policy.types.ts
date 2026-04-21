import {
  ConfidentialityLevel,
  PolicyBundle,
  UploadContentKind,
} from '../../generated/prisma/index.js';

export type SourceCreationPolicyInput = {
  confidentialityLevel: ConfidentialityLevel;
  requestedValidityMinutes: number | null;
  burnAfterReadEnabled: boolean;
  contentKind: UploadContentKind;
};

export type SourceCreationPolicyDecision = {
  allowed: boolean;
  decisionReason: string;
  policyBundle: PolicyBundle;
  resolvedValidityMinutes: number | null;
  snapshotFieldsToPersist: {
    confidentialityLevel: ConfidentialityLevel;
    burnAfterReadEnabled: boolean;
    defaultValidityMinutes: number;
    requestedValidityMinutes: number | null;
    resolvedValidityMinutes: number | null;
    allowFutureTrustedDevices: boolean;
    allowOutwardResharing: boolean;
    policyBundleVersion: number;
  };
};

export type ShareCreationPolicyInput = {
  confidentialityLevel: ConfidentialityLevel;
  requestedValidityMinutes: number | null;
};

export type ShareCreationPolicyDecision = {
  allowed: boolean;
  decisionReason: string;
  policyBundle: PolicyBundle;
  resolvedValidityMinutes: number | null;
  allowRepeatDownload: boolean;
  allowRecipientMultiDeviceAccess: boolean;
  snapshotFieldsToPersist: {
    confidentialityLevel: ConfidentialityLevel;
    requestedValidityMinutes: number | null;
    resolvedValidityMinutes: number | null;
    allowRepeatDownload: boolean;
    allowRecipientMultiDeviceAccess: boolean;
    policyBundleVersion: number;
  };
};

export type ExtractionCreationPolicyInput = {
  confidentialityLevel: ConfidentialityLevel;
  requestedValidityMinutes: number | null;
  requestedRetrievalCount: number | null;
};

export type ExtractionCreationPolicyDecision = {
  allowed: boolean;
  decisionReason: string;
  policyBundle: PolicyBundle;
  resolvedValidityMinutes: number | null;
  resolvedRetrievalCount: number;
  requireSystemGeneratedPassword: boolean;
  snapshotFieldsToPersist: {
    confidentialityLevel: ConfidentialityLevel;
    requestedValidityMinutes: number | null;
    resolvedValidityMinutes: number | null;
    requestedRetrievalCount: number | null;
    resolvedRetrievalCount: number;
    requireSystemGeneratedPassword: boolean;
    policyBundleVersion: number;
  };
};

export type PublicLinkCreationPolicyInput = {
  confidentialityLevel: ConfidentialityLevel;
  requestedValidityMinutes: number | null;
  requestedDownloadCount: number | null;
};

export type PublicLinkCreationPolicyDecision = {
  allowed: boolean;
  decisionReason: string;
  policyBundle: PolicyBundle;
  resolvedValidityMinutes: number | null;
  resolvedDownloadCount: number;
  snapshotFieldsToPersist: {
    confidentialityLevel: ConfidentialityLevel;
    requestedValidityMinutes: number | null;
    resolvedValidityMinutes: number | null;
    requestedDownloadCount: number | null;
    resolvedDownloadCount: number;
    policyBundleVersion: number;
  };
};
