export const ApprovalStatus = {
  NOT_REQUIRED: 'NOT_REQUIRED',
  APPROVAL_REQUIRED: 'APPROVAL_REQUIRED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
} as const;

export type ApprovalStatus = (typeof ApprovalStatus)[keyof typeof ApprovalStatus];

export interface ApprovalRecord {
  readonly status: ApprovalStatus;
  readonly requiredByPolicy?: string | undefined;
  readonly approvedBy?: string | undefined;
  readonly approvedAt?: number | undefined;
  readonly rejectedBy?: string | undefined;
  readonly rejectedAt?: number | undefined;
  readonly rejectionReason?: string | undefined;
  readonly expiresAt?: number | undefined;
}
