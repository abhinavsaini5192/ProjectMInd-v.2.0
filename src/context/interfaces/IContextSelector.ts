import type { ContextPlan } from '../models/ContextPlan.js';
import type { ContextRequest } from '../models/ContextRequest.js';
import type { RetrievedContextData } from './IContextRetriever.js';
import type { ContextFeature } from '../models/ContextFeature.js';
import type { ContextResource } from '../models/ContextResource.js';

export interface SelectedContextData {
  features: ContextFeature[];
  resources: ContextResource[];
  behaviorFlows: any[];
  tests: any[];
  risks: any[];
  milestones: any[];
  explanations: Record<string, string>;
}

export interface IContextSelector {
  select(
    retrieved: RetrievedContextData,
    plan: ContextPlan,
    request: ContextRequest
  ): SelectedContextData;
}
