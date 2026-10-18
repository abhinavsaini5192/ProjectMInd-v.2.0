import type { KnowledgeArea } from './KnowledgeArea.js';

export interface PlannedOperation {
  readonly operationId: string;
  readonly area: KnowledgeArea;
  readonly action: 'MAP' | 'DEACTIVATE_MAPPING' | 'UPDATE_DEPENDENCY' | 'ANALYZE_BEHAVIOR' | 'ANALYZE_HEALTH' | 'ANALYZE_IMPACT' | 'APPEND_HISTORY' | 'INVALIDATE_CONTEXT' | 'REFRESH_CONTEXT';
  readonly targetId: string;
  readonly dependencies: readonly string[]; // operationIds that must execute prior
  readonly payload?: Record<string, unknown> | undefined;
}

export interface KnowledgeUpdatePlan {
  readonly planId: string;
  readonly updateId: string;
  readonly targetResources: readonly string[];
  readonly targetFeatures: readonly string[];
  readonly targetKnowledgeAreas: readonly KnowledgeArea[];
  readonly operations: readonly PlannedOperation[];
  readonly invalidationTargets: readonly string[];
  readonly refreshTargets: readonly string[];
  readonly expectedNewKnowledgeVersion?: string | undefined;
  readonly confidence: number;
  readonly warnings: readonly string[];
  readonly conflicts: readonly string[];
  readonly skippedAreas: readonly KnowledgeArea[];
  readonly reasonCodes: readonly string[];
  readonly createdAt: number;
}
