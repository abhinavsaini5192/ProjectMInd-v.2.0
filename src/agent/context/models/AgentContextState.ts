import type { AgentChangeSet } from './AgentChangeSet.js';
import type { ContextRefreshReason } from './ContextRefreshReason.js';

export type ContextFreshnessStatus =
  | 'CURRENT'
  | 'PARTIALLY_STALE'
  | 'STALE'
  | 'UNKNOWN';

export interface ContextQualityMetadata {
  readonly completeness: number;
  readonly confidence: number;
  readonly freshness: ContextFreshnessStatus;
  readonly relevance: number;
  readonly budgetUtilization: number;
}

export interface AgentContextState {
  readonly selectedFeatures: readonly string[];
  readonly selectedResources: readonly string[];
  readonly includedSections: readonly string[];
  readonly omittedSections: readonly string[];
  readonly currentContextPackageId: string;
  readonly contextVersion: number;
  readonly knowledgeVersion: string;
  readonly freshness: ContextFreshnessStatus;
  readonly staleSections: readonly string[];
  readonly warnings: readonly string[];
  readonly lastChangeSet?: AgentChangeSet | undefined;
  readonly lastRefreshReason?: ContextRefreshReason | undefined;
}
