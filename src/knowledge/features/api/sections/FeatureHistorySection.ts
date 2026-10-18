import type { SectionStatus } from '../models/FeatureKnowledgeSection.js';
import type { FeatureKnowledgeErrorInfo } from '../models/FeatureKnowledgeErrorInfo.js';

export interface MilestoneItem {
  milestoneId: string;
  milestoneType: string;
  title: string;
  description: string;
  timestamp: number;
  importance: string;
}

export interface TrendItem {
  trendType: string;
  direction: string;
  description: string;
}

export interface FeatureHistoryData {
  firstSeenAt: number;
  lastUpdatedAt: number;
  versionCount: number;
  maturityLevel: string;
  milestones: MilestoneItem[];
  trends: TrendItem[];
  recentEventsCount: number;
  regressionsCount: number;
}

export interface FeatureHistorySection {
  status: SectionStatus;
  reason?: string | undefined;
  itemCount: number;
  confidence?: number | undefined;
  freshness?: string | undefined;
  knowledgeVersion?: string | undefined;
  lastUpdatedAt?: number | undefined;
  sourceSubsystem?: string | undefined;
  error?: FeatureKnowledgeErrorInfo | undefined;
  data?: FeatureHistoryData | undefined;
}
