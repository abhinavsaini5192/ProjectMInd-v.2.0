import type { SectionStatus } from '../models/FeatureKnowledgeSection.js';
import type { FeatureKnowledgeErrorInfo } from '../models/FeatureKnowledgeErrorInfo.js';

export interface BehaviorFlowItem {
  flowId: string;
  name: string;
  type: string;
  isPrimary: boolean;
  isFailure: boolean;
  stepsCount: number;
  entryPoint?: string | undefined;
}

export interface FeatureBehaviorData {
  entryPoints: string[];
  primaryFlows: BehaviorFlowItem[];
  failureFlows: BehaviorFlowItem[];
  allFlows: BehaviorFlowItem[];
}

export interface FeatureBehaviorSection {
  status: SectionStatus;
  reason?: string | undefined;
  itemCount: number;
  confidence?: number | undefined;
  freshness?: string | undefined;
  knowledgeVersion?: string | undefined;
  lastUpdatedAt?: number | undefined;
  sourceSubsystem?: string | undefined;
  error?: FeatureKnowledgeErrorInfo | undefined;
  data?: FeatureBehaviorData | undefined;
}
