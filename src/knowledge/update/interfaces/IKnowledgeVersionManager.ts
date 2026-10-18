import type { KnowledgeVersion } from '../models/KnowledgeVersion.js';
import type { KnowledgeArea } from '../models/KnowledgeArea.js';

export interface CreateVersionParams {
  readonly repositoryId: string;
  readonly workspaceId?: string | undefined;
  readonly sourceUpdateIds: readonly string[];
  readonly affectedAreas: readonly KnowledgeArea[];
  readonly affectedResources: readonly string[];
  readonly affectedFeatures: readonly string[];
  readonly confidence?: number | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
}

export interface IKnowledgeVersionManager {
  getLatestVersion(repositoryId: string): Promise<KnowledgeVersion | null>;
  createNextVersion(params: CreateVersionParams): Promise<KnowledgeVersion>;
  shouldIncrementVersion(
    appliedAreas: readonly KnowledgeArea[],
    affectedResources: readonly string[],
    affectedFeatures: readonly string[]
  ): boolean;
}
