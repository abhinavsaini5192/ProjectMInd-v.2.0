import type { VerificationSource } from './VerificationSource.js';

export type VerificationLevel =
  | 'AGENT_REPORTED'
  | 'SYSTEM_OBSERVED'
  | 'SYSTEM_VERIFIED'
  | 'MANUALLY_CONFIRMED'
  | 'INFERRED'
  | 'UNKNOWN';

export type VerificationTrustLevel =
  | 'UNTRUSTED'
  | 'SEMI_TRUSTED'
  | 'TRUSTED'
  | 'AUTHORITATIVE';

export interface VerificationProvenance {
  readonly source: VerificationSource;
  readonly reportedBy: string;
  readonly receivedAt: string;
  readonly observedAt?: string | undefined;
  readonly verificationLevel: VerificationLevel;
  readonly trustLevel: VerificationTrustLevel;
}

export const VERIFICATION_LEVEL_PRECEDENCE: Record<VerificationLevel, number> = {
  AUTHORITATIVE: 5, // fallback if used
  SYSTEM_VERIFIED: 4,
  MANUALLY_CONFIRMED: 4,
  SYSTEM_OBSERVED: 3,
  AGENT_REPORTED: 2,
  INFERRED: 1,
  UNKNOWN: 0,
} as unknown as Record<VerificationLevel, number>;

export const VERIFICATION_TRUST_PRECEDENCE: Record<VerificationTrustLevel, number> = {
  AUTHORITATIVE: 4,
  TRUSTED: 3,
  SEMI_TRUSTED: 2,
  UNTRUSTED: 1,
};

export function isTrustedVerification(provenance: VerificationProvenance): boolean {
  return (
    (provenance.verificationLevel === 'SYSTEM_VERIFIED' ||
      provenance.verificationLevel === 'MANUALLY_CONFIRMED') &&
    (provenance.trustLevel === 'TRUSTED' || provenance.trustLevel === 'AUTHORITATIVE')
  );
}
