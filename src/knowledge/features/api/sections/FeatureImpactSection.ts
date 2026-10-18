import type { SectionStatus } from '../models/FeatureKnowledgeSection.js';
import type { FeatureKnowledgeErrorInfo } from '../models/FeatureKnowledgeErrorInfo.js';

export interface ImpactedTargetItem {
  targetId: string;
  targetType: 'FEATURE' | 'RESOURCE';
  severity: string;
  impactType: string;
  score: number;
  distance: number;
}

export interface FeatureImpactData {
  impactRadius: number;
  impactScore: number;
  impactedFeatures: ImpactedTargetItem[];
  impactedResources: ImpactedTargetItem[];
  propagationPathsCount: number;
}

export interface FeatureImpactSection {
  status: SectionStatus;
  reason?: string | undefined;
  itemCount: number;
  confidence?: number | undefined;
  freshness?: string | undefined;
  knowledgeVersion?: string | undefined;
  lastUpdatedAt?: number | undefined;
  sourceSubsystem?: string | undefined;
  error?: FeatureKnowledgeErrorInfo | undefined;
  data?: FeatureImpactData | undefined;
}
