import type { SectionStatus } from '../models/FeatureKnowledgeSection.js';
import type { FeatureKnowledgeErrorInfo } from '../models/FeatureKnowledgeErrorInfo.js';

export interface RiskItem {
  riskId: string;
  type: string;
  severity: string;
  score: number;
  description: string;
  mitigation?: string | undefined;
}

export interface FeatureHealthData {
  healthScore: number;
  healthStatus: string;
  verificationQuality?: string | undefined;
  criticalityScore: number;
  criticalityLevel: string;
  risks: RiskItem[];
  dimensions?: Record<string, number> | undefined;
}

export interface FeatureHealthSection {
  status: SectionStatus;
  reason?: string | undefined;
  itemCount: number;
  confidence?: number | undefined;
  freshness?: string | undefined;
  knowledgeVersion?: string | undefined;
  lastUpdatedAt?: number | undefined;
  sourceSubsystem?: string | undefined;
  error?: FeatureKnowledgeErrorInfo | undefined;
  data?: FeatureHealthData | undefined;
}
