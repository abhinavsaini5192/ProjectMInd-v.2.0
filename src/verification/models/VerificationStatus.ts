export type VerificationStatus =
  | 'PASSED'
  | 'FAILED'
  | 'PARTIAL'
  | 'SKIPPED'
  | 'BLOCKED'
  | 'CANCELLED'
  | 'RUNNING'
  | 'UNKNOWN';

export const VERIFICATION_STATUSES: readonly VerificationStatus[] = [
  'PASSED',
  'FAILED',
  'PARTIAL',
  'SKIPPED',
  'BLOCKED',
  'CANCELLED',
  'RUNNING',
  'UNKNOWN',
];

export function isVerificationSuccessful(status: VerificationStatus): boolean {
  return status === 'PASSED';
}

export function isVerificationTerminal(status: VerificationStatus): boolean {
  return (
    status === 'PASSED' ||
    status === 'FAILED' ||
    status === 'PARTIAL' ||
    status === 'SKIPPED' ||
    status === 'CANCELLED'
  );
}
