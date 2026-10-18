import type { FeedbackSourceType } from './FeedbackSourceType.js';
import type { FeedbackType } from './FeedbackType.js';
import type { FeedbackSignal } from './FeedbackSignal.js';
import type { FeedbackProvenance } from './FeedbackProvenance.js';
import type { LearningScopeRef } from './LearningScope.js';

export interface Feedback {
  readonly id: string;
  readonly workspaceId: string;
  readonly projectId: string;
  readonly repositoryIds: readonly string[];
  readonly sourceType: FeedbackSourceType;
  readonly sourceId: string;
  readonly feedbackType: FeedbackType;
  readonly targetType: string;
  readonly targetId: string;
  readonly signal: FeedbackSignal;
  readonly value: number; // Normalized numeric score [-1.0 to 1.0]
  readonly confidence: number; // [0.0 to 1.0]
  readonly provenance: FeedbackProvenance;
  readonly scope: LearningScopeRef;
  readonly timestamp: number;
  readonly contextReference?: string | undefined;
  readonly taskReference?: string | undefined;
  readonly sessionReference?: string | undefined;
  readonly planReference?: string | undefined;
  readonly evidenceReferences: readonly string[];
  readonly metadata: Record<string, any>;
  readonly deduplicationKey?: string | undefined;
}

export interface RawFeedbackInput {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly repositoryIds?: readonly string[] | undefined;
  readonly sourceType: FeedbackSourceType;
  readonly sourceId: string;
  readonly feedbackType: FeedbackType;
  readonly targetType: string;
  readonly targetId: string;
  readonly signal?: FeedbackSignal | undefined;
  readonly value?: number | undefined;
  readonly confidence?: number | undefined;
  readonly provenance?: Partial<FeedbackProvenance> | undefined;
  readonly scope?: Partial<LearningScopeRef> | undefined;
  readonly contextReference?: string | undefined;
  readonly taskReference?: string | undefined;
  readonly sessionReference?: string | undefined;
  readonly planReference?: string | undefined;
  readonly evidenceReferences?: readonly string[] | undefined;
  readonly metadata?: Record<string, any> | undefined;
}
