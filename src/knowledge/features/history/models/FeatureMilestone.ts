import type { FeatureHistoryConfidence } from './FeatureHistoryConfidence.js';

export type MilestoneImportance = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface MilestoneEvidence {
  type: string;
  description: string;
  source?: string | undefined;
}

export interface FeatureMilestone {
  milestoneId: string;
  featureId: string;
  milestoneType: string;
  title: string;
  description: string;
  timestamp: number;
  evidence: MilestoneEvidence[];
  confidence: FeatureHistoryConfidence;
  relatedEventIds: string[];
  importance: MilestoneImportance;
}
