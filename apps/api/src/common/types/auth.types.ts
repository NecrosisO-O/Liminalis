export type AuthenticatedSession = {
  sessionId: string;
  userId: string;
  role: 'ADMIN' | 'REGULAR_USER';
  admissionState: 'PENDING_APPROVAL' | 'APPROVED';
  enablementState: 'ENABLED' | 'DISABLED';
  trustedDeviceId: string | null;
};
