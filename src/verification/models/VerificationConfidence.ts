export type VerificationConfidence =
  | 'CONFIRMED'
  | 'HIGH'
  | 'MEDIUM'
  | 'LOW'
  | 'UNKNOWN';

export const VERIFICATION_CONFIDENCE_LEVELS: readonly VerificationConfidence[] = [
  'CONFIRMED',
  'HIGH',
  'MEDIUM',
  'LOW',
  'UNKNOWN',
];

export const VERIFICATION_CONFIDENCE_PRECEDENCE: Record<VerificationConfidence, number> = {
  CONFIRMED: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
  UNKNOWN: 0,
};
