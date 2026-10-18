import type { ContextPlan } from '../models/ContextPlan.js';
import type { ContextRequest } from '../models/ContextRequest.js';
import type { ContextWarning } from '../models/ContextWarning.js';
import type { FeatureKnowledgeResponse } from '../../knowledge/features/api/models/FeatureKnowledgeResponse.js';

export interface RetrievedContextData {
  featureKnowledgeMap: Map<string, FeatureKnowledgeResponse>;
  impactMap: Map<string, any[]>;
  resolvedDirectFeatures: string[];
  resolvedDependencyFeatures: string[];
  warnings: ContextWarning[];
}

export interface IContextRetriever {
  retrieveContext(plan: ContextPlan, request: ContextRequest): Promise<RetrievedContextData>;
}
