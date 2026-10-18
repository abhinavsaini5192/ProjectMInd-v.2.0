import type { ResourceScope } from '../../security/models/ResourceScope.js';

export type TaskType =
  | 'IMPLEMENTATION'
  | 'BUG_FIX'
  | 'REFACTOR'
  | 'DEBUGGING'
  | 'EXPLANATION'
  | 'INVESTIGATION'
  | 'TESTING'
  | 'REVIEW'
  | 'DOCUMENTATION'
  | 'ARCHITECTURE'
  | 'PERFORMANCE'
  | 'SECURITY'
  | 'MIGRATION'
  | 'UNKNOWN';

export type TaskIntent =
  | 'ADD'
  | 'MODIFY'
  | 'REMOVE'
  | 'DEBUG'
  | 'UNDERSTAND'
  | 'EXPLAIN'
  | 'REVIEW'
  | 'TEST'
  | 'OPTIMIZE'
  | 'MIGRATE'
  | 'INVESTIGATE'
  | 'DESIGN'
  | 'TRACE'
  | 'COMPARE'
  | 'UNKNOWN';

export interface TaskConstraint {
  readonly type: 'EXPLICIT_CONSTRAINT' | 'INFERRED_CONSTRAINT';
  readonly description: string;
  readonly confidence: number; // 0.0 - 1.0 (inferred constraints must be <= 0.7)
  readonly source: string;
}

export interface TaskUnderstanding {
  readonly taskId: string;
  readonly rawRequest: string;
  readonly normalizedRequest: string;
  readonly taskType: TaskType;
  readonly intent: TaskIntent;
  readonly targetEntities: readonly string[];
  readonly candidateFeatures: readonly string[];
  readonly candidateResources: readonly string[];
  readonly requestedAction: string;
  readonly constraints: readonly TaskConstraint[];
  readonly scope: ResourceScope;
  readonly confidence: number; // 0.0 - 1.0
  readonly provenance: string; // e.g. "DETERMINISTIC_RULES" | "SEMANTIC_SLM"
}
