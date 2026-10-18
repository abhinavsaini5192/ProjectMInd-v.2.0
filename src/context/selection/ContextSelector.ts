import type { IContextSelector, SelectedContextData } from '../interfaces/IContextSelector.js';
import type { ContextPlan } from '../models/ContextPlan.js';
import type { ContextRequest } from '../models/ContextRequest.js';
import type { RetrievedContextData } from '../interfaces/IContextRetriever.js';
import { ContextResourceSelector } from './ContextResourceSelector.js';
import { ContextFeatureSelector } from './ContextFeatureSelector.js';
import { ContextEvidenceSelector } from './ContextEvidenceSelector.js';
import { ContextSelectionValidator } from './ContextSelectionValidator.js';

export class ContextSelector implements IContextSelector {
  public select(
    retrieved: RetrievedContextData,
    plan: ContextPlan,
    request: ContextRequest
  ): SelectedContextData {
    const rawResources = ContextResourceSelector.selectResources(
      retrieved.featureKnowledgeMap,
      new Map(),
      request
    );

    const featureResult = ContextFeatureSelector.selectFeatures(
      retrieved.featureKnowledgeMap,
      retrieved.resolvedDirectFeatures,
      rawResources,
      request
    );

    // Re-select resources with actual feature relevance scores
    const resources = ContextResourceSelector.selectResources(
      retrieved.featureKnowledgeMap,
      featureResult.featureRelevanceMap,
      request
    );

    const evidence = ContextEvidenceSelector.selectEvidence(
      retrieved.featureKnowledgeMap
    );

    const explanations: Record<string, string> = {};
    if (request.explainSelection || request.includeExplanations) {
      for (const feat of featureResult.features) {
        explanations[feat.featureId] = `Feature '${feat.name}' selected as ${feat.role} with score ${feat.relevance.score}. Reasons: ${feat.relevance.reasons.join(' ')}`;
      }
      for (const res of resources.slice(0, 10)) {
        explanations[res.resourceId] = `Resource '${res.filePath ?? res.resourceId}' selected for feature '${res.featureId}' with score ${res.relevance.score}. Reasons: ${res.relevance.reasons.join(' ')}`;
      }
    }

    const selectedData: SelectedContextData = {
      features: featureResult.features,
      resources,
      behaviorFlows: evidence.behaviorFlows,
      tests: evidence.tests,
      risks: evidence.risks,
      milestones: evidence.milestones,
      explanations,
    };

    ContextSelectionValidator.validate(selectedData, retrieved);

    return selectedData;
  }
}
