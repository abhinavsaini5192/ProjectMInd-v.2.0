import type { IContextRetriever, RetrievedContextData } from '../interfaces/IContextRetriever.js';
import type { ContextPlan } from '../models/ContextPlan.js';
import type { ContextRequest } from '../models/ContextRequest.js';
import type { ContextWarning } from '../models/ContextWarning.js';
import type { IFeatureKnowledgeAPI } from '../../knowledge/features/api/interfaces/IFeatureKnowledgeAPI.js';
import type { IFeatureRepository } from '../../knowledge/features/interfaces/IFeatureRepository.js';
import type { IFeatureMappingRepository } from '../../knowledge/features/mapping/interfaces/IFeatureMappingRepository.js';
import { FeatureContextRetriever } from './FeatureContextRetriever.js';
import { ResourceContextRetriever } from './ResourceContextRetriever.js';
import { TaskContextRetriever } from './TaskContextRetriever.js';
import { ImpactContextRetriever } from './ImpactContextRetriever.js';

export class ContextRetrievalCoordinator implements IContextRetriever {
  private readonly featureRetriever: FeatureContextRetriever;
  private readonly resourceRetriever: ResourceContextRetriever;
  private readonly taskRetriever: TaskContextRetriever;
  private readonly impactRetriever: ImpactContextRetriever;

  constructor(
    featureKnowledgeApi: IFeatureKnowledgeAPI,
    featureRepository?: IFeatureRepository | undefined,
    mappingRepository?: IFeatureMappingRepository | undefined
  ) {
    this.featureRetriever = new FeatureContextRetriever(featureKnowledgeApi);
    this.resourceRetriever = new ResourceContextRetriever(mappingRepository, featureRepository);
    this.taskRetriever = new TaskContextRetriever(featureRepository);
    this.impactRetriever = new ImpactContextRetriever(featureKnowledgeApi);
  }

  public async retrieveContext(
    plan: ContextPlan,
    request: ContextRequest
  ): Promise<RetrievedContextData> {
    const warnings: ContextWarning[] = [];
    let targetFeatureIds = [...plan.targetFeatureIds];

    // If target features were not provided in the plan, resolve them dynamically
    if (targetFeatureIds.length === 0) {
      if (request.changedResources && request.changedResources.length > 0) {
        const fromResources = await this.resourceRetriever.resolveFeaturesFromResources(
          request.changedResources
        );
        targetFeatureIds.push(...fromResources);
      } else if (request.resourceIds && request.resourceIds.length > 0) {
        const fromResources = await this.resourceRetriever.resolveFeaturesFromResources(
          request.resourceIds
        );
        targetFeatureIds.push(...fromResources);
      }

      if (targetFeatureIds.length === 0 && (request.taskText || request.taskIntent)) {
        const fromTask = await this.taskRetriever.resolveFeaturesFromTask(
          request.taskText,
          request.taskIntent,
          request.repositoryId
        );
        targetFeatureIds.push(...fromTask);
      }

      targetFeatureIds = Array.from(new Set(targetFeatureIds));
    }

    if (targetFeatureIds.length === 0) {
      warnings.push({
        type: 'UNRESOLVED_FEATURE',
        message: 'No specific features could be resolved for the given request parameters.',
        section: 'IDENTITY',
      });

      return {
        featureKnowledgeMap: new Map(),
        impactMap: new Map(),
        resolvedDirectFeatures: [],
        resolvedDependencyFeatures: [],
        warnings,
      };
    }

    // Retrieve feature knowledge recursively up to plan.maxDepth
    const retrievalResult = await this.featureRetriever.retrieveFeatures(
      targetFeatureIds,
      plan.maxDepth
    );

    warnings.push(...retrievalResult.warnings);

    // Retrieve impact information if requested or changed resources exist
    const impactMap = await this.impactRetriever.retrieveImpactData(
      retrievalResult.directFeatures,
      retrievalResult.knowledgeMap
    );

    return {
      featureKnowledgeMap: retrievalResult.knowledgeMap,
      impactMap,
      resolvedDirectFeatures: retrievalResult.directFeatures,
      resolvedDependencyFeatures: retrievalResult.dependencyFeatures,
      warnings,
    };
  }
}
