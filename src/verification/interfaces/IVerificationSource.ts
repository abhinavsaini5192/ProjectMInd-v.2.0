import type { VerificationSource } from '../models/VerificationSource.js';
import type { VerificationProvenance, VerificationTrustLevel, VerificationLevel } from '../models/VerificationProvenance.js';
import type { VerificationRecord } from '../models/VerificationRecord.js';

export interface SourceCapabilities {
  readonly supportedTypes: readonly string[];
  readonly supportsStreaming?: boolean | undefined;
  readonly canProvideRepositoryState?: boolean | undefined;
}

export interface IVerificationSource {
  getSourceId(): string;
  getSourceType(): VerificationSource;
  getTrustLevel(): VerificationTrustLevel;
  getVerificationLevel(): VerificationLevel;
  getCapabilities(): SourceCapabilities;
}
