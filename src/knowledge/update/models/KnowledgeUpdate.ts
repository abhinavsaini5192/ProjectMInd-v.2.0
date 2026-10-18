import type { KnowledgeUpdateType } from './KnowledgeUpdateType.js';
import type { KnowledgeUpdateSource } from './KnowledgeUpdateSource.js';
import type { KnowledgeUpdateProvenance } from './KnowledgeUpdateProvenance.js';
import type { KnowledgeUpdateStatus } from './KnowledgeUpdateStatus.js';
import type { KnowledgeArea } from './KnowledgeArea.js';
import type { KnowledgeUpdateReference } from './KnowledgeUpdateReference.js';

export interface KnowledgeUpdate {
  readonly updateId: string;
  readonly batchId?: string | undefined;
  readonly sourceEventId?: string | undefined;
  readonly repositoryId: string;
  readonly workspaceId?: string | undefined;
  readonly taskId?: string | undefined;
  readonly agentSessionId?: string | undefined;
  readonly source: KnowledgeUpdateSource;
  readonly provenance: KnowledgeUpdateProvenance;
  readonly updateType: KnowledgeUpdateType;
  readonly status: KnowledgeUpdateStatus;
  readonly affectedResources: readonly string[];
  readonly affectedFeatures: readonly string[];
  readonly affectedKnowledgeAreas: readonly KnowledgeArea[];
  readonly evidenceReferences: readonly KnowledgeUpdateReference[];
  readonly previousKnowledgeVersion?: string | undefined;
  readonly requestedAt: number;
  readonly observedAt?: number | undefined;
  readonly idempotencyKey: string;
  readonly confidence: number;
  readonly retryCount: number;
  readonly lastFailureReason?: string | undefined;
  readonly metadata: Record<string, unknown>;
}

export interface CreateKnowledgeUpdateParams {
  readonly updateId?: string | undefined;
  readonly batchId?: string | undefined;
  readonly sourceEventId?: string | undefined;
  readonly repositoryId: string;
  readonly workspaceId?: string | undefined;
  readonly taskId?: string | undefined;
  readonly agentSessionId?: string | undefined;
  readonly source: KnowledgeUpdateSource;
  readonly provenance?: KnowledgeUpdateProvenance | undefined;
  readonly updateType: KnowledgeUpdateType;
  readonly status?: KnowledgeUpdateStatus | undefined;
  readonly affectedResources?: readonly string[] | undefined;
  readonly affectedFeatures?: readonly string[] | undefined;
  readonly affectedKnowledgeAreas?: readonly KnowledgeArea[] | undefined;
  readonly evidenceReferences?: readonly KnowledgeUpdateReference[] | undefined;
  readonly previousKnowledgeVersion?: string | undefined;
  readonly requestedAt?: number | undefined;
  readonly observedAt?: number | undefined;
  readonly idempotencyKey?: string | undefined;
  readonly confidence?: number | undefined;
  readonly retryCount?: number | undefined;
  readonly lastFailureReason?: string | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
}
