import type { KnowledgeUpdate } from '../../../knowledge/update/models/KnowledgeUpdate.js';
import type { KnowledgeUpdateResult } from '../../../knowledge/update/models/KnowledgeUpdateResult.js';
import type { KnowledgeUpdateStatus } from '../../../knowledge/update/models/KnowledgeUpdateStatus.js';
import type { KnowledgeVersion } from '../../../knowledge/update/models/KnowledgeVersion.js';

export interface KnowledgeUpdateResponse {
  readonly update: KnowledgeUpdate | KnowledgeUpdateResult;
}

export interface KnowledgeUpdateStatusResponse {
  readonly updateId: string;
  readonly status: KnowledgeUpdateStatus;
  readonly version?: KnowledgeVersion | undefined;
  readonly error?: string | undefined;
}

export interface KnowledgeVersionResponse {
  readonly version: KnowledgeVersion;
}
