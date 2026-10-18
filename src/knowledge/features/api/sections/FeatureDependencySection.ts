import type { SectionStatus } from '../models/FeatureKnowledgeSection.js';
import type { FeatureKnowledgeErrorInfo } from '../models/FeatureKnowledgeErrorInfo.js';

export interface DependencyItem {
  featureId: string;
  relationshipType: string;
  confidence: number;
  criticality?: string | undefined;
  direct: boolean;
}

export interface FeatureDependencyData {
  dependencies: DependencyItem[]; // Outgoing
  dependents: DependencyItem[]; // Incoming
  relationshipCount: number;
}

export interface FeatureDependencySection {
  status: SectionStatus;
  reason?: string | undefined;
  itemCount: number;
  confidence?: number | undefined;
  freshness?: string | undefined;
  knowledgeVersion?: string | undefined;
  lastUpdatedAt?: number | undefined;
  sourceSubsystem?: string | undefined;
  error?: FeatureKnowledgeErrorInfo | undefined;
  data?: FeatureDependencyData | undefined;
}
