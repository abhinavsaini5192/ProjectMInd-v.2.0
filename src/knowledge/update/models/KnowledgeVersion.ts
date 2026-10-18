import type { KnowledgeArea } from './KnowledgeArea.js';

export interface KnowledgeVersion {
  readonly versionId: string;
  readonly versionNumber: number;
  readonly repositoryId: string;
  readonly workspaceId?: string | undefined;
  readonly parentVersionId?: string | undefined;
  readonly createdAt: number;
  readonly sourceUpdateIds: readonly string[];
  readonly affectedKnowledgeAreas: readonly KnowledgeArea[];
  readonly affectedResources: readonly string[];
  readonly affectedFeatures: readonly string[];
  readonly status: 'ACTIVE' | 'SUPERSEDED' | 'ROLLED_BACK';
  readonly completeness: 'COMPLETE' | 'PARTIAL' | 'INCOMPLETE' | 'UNKNOWN';
  readonly confidence: number;
  readonly metadata: Record<string, unknown>;
}
