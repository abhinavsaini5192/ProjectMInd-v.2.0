import type { KnowledgeUpdate } from './KnowledgeUpdate.js';

export interface KnowledgeUpdateBatch {
  readonly batchId: string;
  readonly repositoryId: string;
  readonly workspaceId?: string | undefined;
  readonly updates: readonly KnowledgeUpdate[];
  readonly createdAt: number;
}
