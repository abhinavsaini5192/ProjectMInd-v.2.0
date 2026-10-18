import type { LearningAuthority } from './LearningAuthority.js';

export interface FeedbackProvenance {
  readonly origin: string;
  readonly isExplicit: boolean;
  readonly authority: LearningAuthority;
  readonly actorId?: string | undefined;
  readonly actorRole?: string | undefined;
  readonly verificationId?: string | undefined;
  readonly verificationPassed?: boolean | undefined;
  readonly sessionId?: string | undefined;
  readonly correlationId?: string | undefined;
}
