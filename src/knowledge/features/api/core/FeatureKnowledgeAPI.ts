import type { IFeatureKnowledgeAPI } from '../interfaces/IFeatureKnowledgeAPI.js';
import type { IFeatureKnowledgeQueryService } from '../interfaces/IFeatureKnowledgeQueryService.js';
import type { FeatureKnowledgeQuery } from '../models/FeatureKnowledgeQuery.js';
import type { FeatureKnowledgeOptions } from '../models/FeatureKnowledgeOptions.js';
import type { FeatureKnowledgeResponse } from '../models/FeatureKnowledgeResponse.js';
import type { FeatureKnowledgeSummary } from '../models/FeatureKnowledgeSummary.js';
import type { FeatureKnowledgeContextPackage } from '../models/FeatureKnowledgeContextPackage.js';
import type { FeatureKnowledgeCompleteness } from '../models/FeatureKnowledgeCompleteness.js';
import type { FeatureKnowledgeFreshness } from '../models/FeatureKnowledgeFreshness.js';
import type { FeatureKnowledgeVersion } from '../models/FeatureKnowledgeVersion.js';
import type { FeatureMappingSection } from '../sections/FeatureMappingSection.js';
import type { FeatureDependencySection } from '../sections/FeatureDependencySection.js';
import type { FeatureBehaviorSection } from '../sections/FeatureBehaviorSection.js';
import type { FeatureHealthSection } from '../sections/FeatureHealthSection.js';
import type { FeatureImpactSection } from '../sections/FeatureImpactSection.js';
import type { FeatureHistorySection } from '../sections/FeatureHistorySection.js';
import type { FeatureArchitectureSection } from '../sections/FeatureArchitectureSection.js';

export class FeatureKnowledgeAPI implements IFeatureKnowledgeAPI {
  constructor(private readonly queryService: IFeatureKnowledgeQueryService) {}

  public async getFeatureKnowledge(
    queryOrId: FeatureKnowledgeQuery | string
  ): Promise<FeatureKnowledgeResponse> {
    const query: FeatureKnowledgeQuery =
      typeof queryOrId === 'string' ? { featureId: queryOrId } : queryOrId;

    return this.queryService.query(query);
  }

  public async getFeatureProfile(
    featureId: string,
    options?: FeatureKnowledgeOptions | undefined
  ): Promise<FeatureKnowledgeResponse> {
    return this.getFeatureKnowledge({
      featureId,
      ...options,
    });
  }

  public async getFeatureSummary(
    featureId: string,
    options?: FeatureKnowledgeOptions | undefined
  ): Promise<FeatureKnowledgeSummary> {
    const res = await this.getFeatureKnowledge({
      featureId,
      sections: ['SUMMARY'],
      ...options,
    });

    if (res.profile.summary.data) {
      return res.profile.summary.data;
    }

    return {
      featureId,
      name: res.profile.identity.data?.name ?? featureId,
      type: res.profile.identity.data?.type ?? 'USER_FACING',
      status: res.profile.identity.data?.status ?? 'ACTIVE',
      description: res.profile.identity.data?.description ?? '',
      mappedResourceCount: 0,
      dependencyCount: 0,
      dependentCount: 0,
      flowCount: 0,
      healthScore: 100,
      riskScore: 0,
      criticalityLevel: 'MEDIUM',
      maturityLevel: 'MATURE',
      keyRisks: [],
      recentMilestones: [],
    };
  }

  public async getFeatureMappings(
    featureId: string,
    options?: FeatureKnowledgeOptions | undefined
  ): Promise<FeatureMappingSection> {
    const res = await this.getFeatureKnowledge({
      featureId,
      sections: ['MAPPINGS'],
      ...options,
    });
    return res.profile.mappings;
  }

  public async getFeatureDependencies(
    featureId: string,
    options?: FeatureKnowledgeOptions | undefined
  ): Promise<FeatureDependencySection> {
    const res = await this.getFeatureKnowledge({
      featureId,
      sections: ['DEPENDENCIES'],
      ...options,
    });
    return res.profile.dependencies;
  }

  public async getFeatureDependents(
    featureId: string,
    options?: FeatureKnowledgeOptions | undefined
  ): Promise<FeatureDependencySection> {
    const res = await this.getFeatureKnowledge({
      featureId,
      sections: ['DEPENDENTS'],
      ...options,
    });
    return res.profile.dependencies;
  }

  public async getFeatureBehavior(
    featureId: string,
    options?: FeatureKnowledgeOptions | undefined
  ): Promise<FeatureBehaviorSection> {
    const res = await this.getFeatureKnowledge({
      featureId,
      sections: ['BEHAVIOR'],
      ...options,
    });
    return res.profile.behavior;
  }

  public async getFeatureHealth(
    featureId: string,
    options?: FeatureKnowledgeOptions | undefined
  ): Promise<FeatureHealthSection> {
    const res = await this.getFeatureKnowledge({
      featureId,
      sections: ['HEALTH'],
      ...options,
    });
    return res.profile.health;
  }

  public async getFeatureImpact(
    featureId: string,
    options?: FeatureKnowledgeOptions | undefined
  ): Promise<FeatureImpactSection> {
    const res = await this.getFeatureKnowledge({
      featureId,
      sections: ['IMPACT'],
      ...options,
    });
    return res.profile.impact;
  }

  public async getFeatureHistory(
    featureId: string,
    options?: FeatureKnowledgeOptions | undefined
  ): Promise<FeatureHistorySection> {
    const res = await this.getFeatureKnowledge({
      featureId,
      sections: ['HISTORY'],
      ...options,
    });
    return res.profile.history;
  }

  public async getFeatureArchitecture(
    featureId: string,
    options?: FeatureKnowledgeOptions | undefined
  ): Promise<FeatureArchitectureSection> {
    const res = await this.getFeatureKnowledge({
      featureId,
      sections: ['ARCHITECTURE'],
      ...options,
    });
    return res.profile.architecture;
  }

  public async getFeatureContext(
    featureId: string,
    options?: FeatureKnowledgeOptions | undefined
  ): Promise<FeatureKnowledgeContextPackage> {
    const res = await this.getFeatureKnowledge({
      featureId,
      sections: ['CONTEXT'],
      ...options,
    });

    if (!res.profile.contextPackage) {
      throw new Error(`Context package was not generated for feature ${featureId}`);
    }

    return res.profile.contextPackage;
  }

  public async explainFeatureKnowledge(
    query: FeatureKnowledgeQuery
  ): Promise<Record<string, string>> {
    const res = await this.getFeatureKnowledge({
      ...query,
      includeExplanations: true,
    });
    return res.profile.explanations;
  }

  public async getKnowledgeCompleteness(
    query: FeatureKnowledgeQuery
  ): Promise<FeatureKnowledgeCompleteness> {
    const res = await this.getFeatureKnowledge(query);
    return res.profile.completeness;
  }

  public async getKnowledgeFreshness(
    query: FeatureKnowledgeQuery
  ): Promise<FeatureKnowledgeFreshness> {
    const res = await this.getFeatureKnowledge(query);
    return res.profile.freshness;
  }

  public async getKnowledgeVersionStatus(
    query: FeatureKnowledgeQuery
  ): Promise<FeatureKnowledgeVersion> {
    const res = await this.getFeatureKnowledge(query);
    return res.metadata.versionStatus;
  }
}
