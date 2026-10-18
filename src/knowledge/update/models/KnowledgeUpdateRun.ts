import type { KnowledgeArea } from './KnowledgeArea.js';
import type { KnowledgeInvalidation } from './KnowledgeInvalidation.js';
import type { KnowledgeRefreshDecision } from './KnowledgeRefreshDecision.js';
import type { KnowledgeUpdateConflict } from './KnowledgeUpdateConflict.js';

export interface KnowledgeRunStatistics {
  readonly receivedUpdates: number;
  readonly normalizedUpdates: number;
  readonly deduplicatedUpdates: number;
  readonly plannedOperations: number;
  readonly appliedOperations: number;
  readonly skippedOperations: number;
  readonly failedOperations: number;
  readonly conflicts: number;
  readonly invalidations: number;
  readonly refreshRequests: number;
  readonly versionChanged: boolean;
}

export interface KnowledgeUpdateRun {
  readonly runId: string;
  readonly repositoryId: string;
  readonly workspaceId?: string | undefined;
  readonly startedAt: number;
  readonly completedAt?: number | undefined;
  readonly updateIds: readonly string[];
  readonly status: 'RUNNING' | 'COMPLETED' | 'PARTIALLY_COMPLETED' | 'FAILED';
  readonly knowledgeVersionBefore?: string | undefined;
  readonly knowledgeVersionAfter?: string | undefined;
  readonly affectedResources: readonly string[];
  readonly affectedFeatures: readonly string[];
  readonly updatedKnowledgeAreas: readonly KnowledgeArea[];
  readonly invalidations: readonly KnowledgeInvalidation[];
  readonly refreshDecisions: readonly KnowledgeRefreshDecision[];
  readonly conflicts: readonly KnowledgeUpdateConflict[];
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
  readonly statistics: KnowledgeRunStatistics;
}
