import { ConfidentialityLevel } from '../../generated/prisma/index.js';

export type PolicySection = Record<string, boolean | number | string | null>;

export type PolicyBundleSeed = {
  levelName: ConfidentialityLevel;
  lifecycle: PolicySection;
  shareAvailability: PolicySection;
  userTargetedSharing: PolicySection;
  passwordExtraction: PolicySection;
  publicLinks: PolicySection;
  liveTransfer: PolicySection;
};

export const DEFAULT_CONFIDENTIALITY_LEVEL = ConfidentialityLevel.SECRET;

export const POLICY_BUNDLE_DEFAULTS: PolicyBundleSeed[] = [
  {
    levelName: ConfidentialityLevel.SECRET,
    lifecycle: {
      defaultValidityMinutes: 12 * 60,
      maximumValidityMinutes: null,
      allowNeverExpire: true,
      allowValidityExtensionLater: true,
      allowFutureTrustedDevices: true,
      allowOutwardResharing: true,
    },
    shareAvailability: {
      allowOutwardSharing: true,
      restrictToSelfOnly: false,
      allowRecipientResharing: false,
      allowMultipleOutwardShares: true,
      allowUserTargetedSharing: true,
      allowPasswordExtraction: true,
      allowPublicLinks: true,
    },
    userTargetedSharing: {
      defaultShareValidityMinutes: 8 * 60,
      maximumShareValidityMinutes: null,
      allowRepeatDownload: true,
      allowRecipientMultiDeviceAccess: true,
    },
    passwordExtraction: {
      allowPasswordExtraction: true,
      requireSystemGeneratedPassword: false,
      maximumRetrievalCount: 5,
    },
    publicLinks: {
      allowPublicLinks: true,
      maximumPublicLinkValidityMinutes: 24 * 60,
      maximumPublicLinkDownloadCount: 5,
    },
    liveTransfer: {
      allowLiveTransfer: true,
      allowPeerToPeer: true,
      allowRelay: true,
      allowPeerToPeerToRelayFallback: true,
      allowLiveToStoredFallback: true,
      retainLiveTransferRecords: true,
      allowGroupedOrLargeLiveTransfer: true,
    },
  },
  {
    levelName: ConfidentialityLevel.CONFIDENTIAL,
    lifecycle: {
      defaultValidityMinutes: 2 * 60,
      maximumValidityMinutes: 24 * 60,
      allowNeverExpire: false,
      allowValidityExtensionLater: true,
      allowFutureTrustedDevices: true,
      allowOutwardResharing: true,
    },
    shareAvailability: {
      allowOutwardSharing: true,
      restrictToSelfOnly: false,
      allowRecipientResharing: false,
      allowMultipleOutwardShares: true,
      allowUserTargetedSharing: true,
      allowPasswordExtraction: true,
      allowPublicLinks: false,
    },
    userTargetedSharing: {
      defaultShareValidityMinutes: 2 * 60,
      maximumShareValidityMinutes: 24 * 60,
      allowRepeatDownload: true,
      allowRecipientMultiDeviceAccess: true,
    },
    passwordExtraction: {
      allowPasswordExtraction: true,
      requireSystemGeneratedPassword: true,
      maximumRetrievalCount: 3,
    },
    publicLinks: {
      allowPublicLinks: false,
      maximumPublicLinkValidityMinutes: null,
      maximumPublicLinkDownloadCount: null,
    },
    liveTransfer: {
      allowLiveTransfer: true,
      allowPeerToPeer: true,
      allowRelay: true,
      allowPeerToPeerToRelayFallback: true,
      allowLiveToStoredFallback: false,
      retainLiveTransferRecords: true,
      allowGroupedOrLargeLiveTransfer: true,
    },
  },
  {
    levelName: ConfidentialityLevel.TOP_SECRET,
    lifecycle: {
      defaultValidityMinutes: 10,
      maximumValidityMinutes: 60,
      allowNeverExpire: false,
      allowValidityExtensionLater: false,
      allowFutureTrustedDevices: false,
      allowOutwardResharing: false,
    },
    shareAvailability: {
      allowOutwardSharing: false,
      restrictToSelfOnly: true,
      allowRecipientResharing: false,
      allowMultipleOutwardShares: false,
      allowUserTargetedSharing: false,
      allowPasswordExtraction: false,
      allowPublicLinks: false,
    },
    userTargetedSharing: {
      defaultShareValidityMinutes: null,
      maximumShareValidityMinutes: null,
      allowRepeatDownload: false,
      allowRecipientMultiDeviceAccess: false,
    },
    passwordExtraction: {
      allowPasswordExtraction: false,
      requireSystemGeneratedPassword: true,
      maximumRetrievalCount: null,
    },
    publicLinks: {
      allowPublicLinks: false,
      maximumPublicLinkValidityMinutes: null,
      maximumPublicLinkDownloadCount: null,
    },
    liveTransfer: {
      allowLiveTransfer: true,
      allowPeerToPeer: true,
      allowRelay: false,
      allowPeerToPeerToRelayFallback: false,
      allowLiveToStoredFallback: false,
      retainLiveTransferRecords: false,
      allowGroupedOrLargeLiveTransfer: true,
    },
  },
];
