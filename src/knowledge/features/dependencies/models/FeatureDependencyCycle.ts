import type { FeatureRelationship } from './FeatureRelationship';
import type { FeatureRelationshipEvidence } from './FeatureRelationshipEvidence';

export type CycleClassification = 'VALIDATED_CYCLE' | 'SUSPECTED_CYCLE' | 'ARCHITECTURAL_RISK';

export interface FeatureDependencyCycle {
  cycleId: string;
  features: string[];
  cyclePath?: string[];
  length?: number;
  relationships: FeatureRelationship[];
  confidence: number;
  evidence: FeatureRelationshipEvidence[];
  classification: CycleClassification;
  createdAt: number;
}
