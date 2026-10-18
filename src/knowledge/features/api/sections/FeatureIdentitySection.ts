import type { SectionStatus } from '../models/FeatureKnowledgeSection.js';
import type { FeatureKnowledgeErrorInfo } from '../models/FeatureKnowledgeErrorInfo.js';

export interface FeatureIdentityData {
  id: string;
  name: string;
  description: string;
  type: string;
  status: string;
  origin?: string | undefined;
  scope?: any;
  metadata?: Record<string, any> | undefined;
  version?: number | undefined;
  createdAt?: number | undefined;
  updatedAt?: number | undefined;
}

export interface FeatureIdentitySection {
  status: SectionStatus;
  reason?: string | undefined;
  itemCount: number;
  confidence?: number | undefined;
  freshness?: string | undefined;
  knowledgeVersion?: string | undefined;
  lastUpdatedAt?: number | undefined;
  sourceSubsystem?: string | undefined;
  error?: FeatureKnowledgeErrorInfo | undefined;
  data?: FeatureIdentityData | undefined;
}
