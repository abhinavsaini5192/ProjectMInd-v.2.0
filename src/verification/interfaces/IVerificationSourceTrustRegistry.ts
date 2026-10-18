import type { VerificationSource } from '../models/VerificationSource.js';
import type { VerificationProvenance, VerificationTrustLevel, VerificationLevel } from '../models/VerificationProvenance.js';
import type { IVerificationSource } from './IVerificationSource.js';

export interface SourceTrustPolicy {
  readonly sourceType: VerificationSource;
  readonly defaultTrustLevel: VerificationTrustLevel;
  readonly defaultVerificationLevel: VerificationLevel;
  readonly isAllowedToVerifyTasks?: boolean | undefined;
}

export interface IVerificationSourceTrustRegistry {
  registerSource(source: IVerificationSource): void;
  getSource(sourceId: string): IVerificationSource | undefined;
  resolveProvenance(
    sourceType: VerificationSource,
    reportedBy: string,
    providedSourceId?: string | undefined,
    observedAt?: string | undefined
  ): VerificationProvenance;
  configureTrustPolicy(sourceType: VerificationSource, policy: SourceTrustPolicy): void;
  getTrustPolicy(sourceType: VerificationSource): SourceTrustPolicy;
}
