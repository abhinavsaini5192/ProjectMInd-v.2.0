import type { FeatureEvolutionType } from './FeatureEvolutionType.js';
import type { FeatureHistoryEvent, HistoryEventEvidence } from './FeatureHistoryEvent.js';
import type { FeatureHistoryConfidence } from './FeatureHistoryConfidence.js';

export interface FeatureEvolutionEvent {
  evolutionId: string;
  featureId: string;
  groupId: string;
  primaryEvolutionType: FeatureEvolutionType;
  sourceEvents: FeatureHistoryEvent[];
  changedDimensions: string[];
  title: string;
  description: string;
  timestamp: number;
  confidence: FeatureHistoryConfidence;
  evidence: HistoryEventEvidence[];
  isSemantic: boolean;
  metadata?: Record<string, any> | undefined;
}
