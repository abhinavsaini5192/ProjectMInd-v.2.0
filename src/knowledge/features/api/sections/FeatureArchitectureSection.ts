import type { SectionStatus } from '../models/FeatureKnowledgeSection.js';
import type { FeatureKnowledgeErrorInfo } from '../models/FeatureKnowledgeErrorInfo.js';

export interface FeatureArchitectureData {
  layer?: string | undefined;
  domain?: string | undefined;
  patterns: string[];
  components: string[];
}

export interface FeatureArchitectureSection {
  status: SectionStatus;
  reason?: string | undefined;
  itemCount: number;
  confidence?: number | undefined;
  freshness?: string | undefined;
  knowledgeVersion?: string | undefined;
  lastUpdatedAt?: number | undefined;
  sourceSubsystem?: string | undefined;
  error?: FeatureKnowledgeErrorInfo | undefined;
  data?: FeatureArchitectureData | undefined;
}
