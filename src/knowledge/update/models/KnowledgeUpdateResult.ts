import type { KnowledgeUpdateStatus } from './KnowledgeUpdateStatus.js';
import type { KnowledgeArea } from './KnowledgeArea.js';
import type { KnowledgeInvalidation } from './KnowledgeInvalidation.js';
import type { KnowledgeRefreshDecision } from './KnowledgeRefreshDecision.js';
import type { KnowledgeUpdateConflict } from './KnowledgeUpdateConflict.js';

export interface KnowledgeUpdateResult {
  readonly updateId: string;
  readonly status: KnowledgeUpdateStatus;
  readonly success: boolean;
  readonly partialSuccess: boolean;
  readonly failure: boolean;
  readonly appliedAreas: readonly KnowledgeArea[];
  readonly failedAreas: readonly KnowledgeArea[];
  readonly skippedAreas: readonly KnowledgeArea[];
  readonly affectedResources: readonly string[];
  readonly affectedFeatures: readonly string[];
  readonly previousKnowledgeVersion?: string | undefined;
  readonly newKnowledgeVersion?: string | undefined;
  readonly invalidations: readonly KnowledgeInvalidation[];
  readonly refreshDecisions: readonly KnowledgeRefreshDecision[];
  readonly conflicts: readonly KnowledgeUpdateConflict[];
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
  readonly retryEligible: boolean;
  readonly processedAt: number;
  readonly metadata: Record<string, unknown>;
}
