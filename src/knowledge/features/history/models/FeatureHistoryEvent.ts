import type { FeatureHistoryEventType } from './FeatureHistoryEventType.js';
import type { FeatureEvolutionType } from './FeatureEvolutionType.js';
import type { FeatureHistorySourceRef } from './FeatureHistorySource.js';
import type { FeatureHistoryConfidence } from './FeatureHistoryConfidence.js';

export interface HistoryEventEvidence {
  type: string;
  description: string;
  source?: string | undefined;
  confidence?: number | undefined;
  data?: Record<string, any> | undefined;
}

export interface FeatureHistoryEvent {
  eventId: string;
  featureId: string;
  eventType: FeatureHistoryEventType;
  evolutionType: FeatureEvolutionType;
  timestamp: number;
  source: FeatureHistorySourceRef;
  sourceReference: string;
  beforeState?: Record<string, any> | undefined;
  afterState?: Record<string, any> | undefined;
  changedDimensions: string[];
  evidence: HistoryEventEvidence[];
  confidence: FeatureHistoryConfidence;
  knowledgeVersion: string;
  metadata?: Record<string, any> | undefined;
}
