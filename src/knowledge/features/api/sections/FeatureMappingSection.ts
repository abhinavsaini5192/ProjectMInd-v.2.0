import type { SectionStatus } from '../models/FeatureKnowledgeSection.js';
import type { FeatureKnowledgeErrorInfo } from '../models/FeatureKnowledgeErrorInfo.js';

export interface MappedResourceItem {
  mappingId: string;
  resourceId: string;
  role: string;
  confidence: number;
  weight?: number | undefined;
  active: boolean;
  metadata?: Record<string, any> | undefined;
}

export interface FeatureMappingData {
  mappings: MappedResourceItem[];
  primaryResources: string[];
  totalMapped: number;
}

export interface FeatureMappingSection {
  status: SectionStatus;
  reason?: string | undefined;
  itemCount: number;
  confidence?: number | undefined;
  freshness?: string | undefined;
  knowledgeVersion?: string | undefined;
  lastUpdatedAt?: number | undefined;
  sourceSubsystem?: string | undefined;
  error?: FeatureKnowledgeErrorInfo | undefined;
  data?: FeatureMappingData | undefined;
}
