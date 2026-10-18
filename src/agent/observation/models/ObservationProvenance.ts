import type { ObservationSource } from './ObservationSource.js';

export type ObservationTrustLevel =
  | 'UNTRUSTED'
  | 'SEMI_TRUSTED'
  | 'TRUSTED'
  | 'AUTHORITATIVE';

export type ObservationVerificationStatus =
  | 'UNVERIFIED'
  | 'AGENT_REPORTED'
  | 'SYSTEM_OBSERVED'
  | 'SYSTEM_VERIFIED'
  | 'INFERRED'
  | 'CONFLICTING';

export interface ObservationProvenance {
  readonly source: ObservationSource;
  readonly sourceId?: string | undefined;
  readonly reportedBy: string;
  readonly observedAt: string;
  readonly receivedAt: string;
  readonly trustLevel: ObservationTrustLevel;
  readonly verificationStatus: ObservationVerificationStatus;
}
