import type { SectionStatus } from '../models/FeatureKnowledgeSection.js';
import type { FeatureKnowledgeErrorInfo } from '../models/FeatureKnowledgeErrorInfo.js';
import type { FeatureKnowledgeSummary } from '../models/FeatureKnowledgeSummary.js';

export interface FeatureSummarySection {
  status: SectionStatus;
  reason?: string | undefined;
  itemCount: number;
  confidence?: number | undefined;
  freshness?: string | undefined;
  knowledgeVersion?: string | undefined;
  lastUpdatedAt?: number | undefined;
  sourceSubsystem?: string | undefined;
  error?: FeatureKnowledgeErrorInfo | undefined;
  data?: FeatureKnowledgeSummary | undefined;
}
