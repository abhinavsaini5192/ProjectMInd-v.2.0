import type { IKnowledgeVersionManager, CreateVersionParams } from '../interfaces/IKnowledgeVersionManager.js';
import type { IKnowledgeUpdateRepository } from '../interfaces/IKnowledgeUpdateRepository.js';
import type { KnowledgeVersion } from '../models/KnowledgeVersion.js';
import type { KnowledgeArea } from '../models/KnowledgeArea.js';

export class KnowledgeVersionManager implements IKnowledgeVersionManager {
  constructor(private readonly repository: IKnowledgeUpdateRepository) {}

  public async getLatestVersion(repositoryId: string): Promise<KnowledgeVersion | null> {
    return this.repository.getLatestVersion(repositoryId);
  }

  public shouldIncrementVersion(
    appliedAreas: readonly KnowledgeArea[],
    affectedResources: readonly string[],
    affectedFeatures: readonly string[]
  ): boolean {
    if (appliedAreas.length === 0) return false;
    if (affectedResources.length === 0 && affectedFeatures.length === 0) return false;

    const CANONICAL_AREAS: KnowledgeArea[] = [
      'FEATURE_MAPPING',
      'FEATURE_DEPENDENCIES',
      'FEATURE_BEHAVIOR',
      'FEATURE_HEALTH',
      'FEATURE_RISK',
      'FEATURE_IMPACT',
      'FEATURE_HISTORY',
      'RESOURCE_METADATA',
      'SYMBOL_KNOWLEDGE',
      'VERIFICATION',
      'API_KNOWLEDGE',
    ];

    return appliedAreas.some((area) => CANONICAL_AREAS.includes(area));
  }

  public async createNextVersion(params: CreateVersionParams): Promise<KnowledgeVersion> {
    const latest = await this.repository.getLatestVersion(params.repositoryId);
    const nextNumber = (latest?.versionNumber ?? 0) + 1;
    const versionId = `K${nextNumber}`;

    const version: KnowledgeVersion = {
      versionId,
      versionNumber: nextNumber,
      repositoryId: params.repositoryId,
      workspaceId: params.workspaceId,
      parentVersionId: latest?.versionId,
      createdAt: Date.now(),
      sourceUpdateIds: [...params.sourceUpdateIds],
      affectedKnowledgeAreas: [...params.affectedAreas],
      affectedResources: [...params.affectedResources],
      affectedFeatures: [...params.affectedFeatures],
      status: 'ACTIVE',
      completeness: 'COMPLETE',
      confidence: params.confidence ?? 0.9,
      metadata: params.metadata ?? {},
    };

    await this.repository.saveVersion(version);
    return version;
  }
}
