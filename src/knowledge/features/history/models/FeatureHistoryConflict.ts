import type { FeatureHistoryConfidence } from './FeatureHistoryConfidence.js';

export type HistoryConflictType =
  | 'CONTRADICTORY_STATUS'
  | 'MAPPING_BEHAVIOR_MISMATCH'
  | 'ORPHAN_REFERENCE'
  | 'VERSION_TIMESTAMP_OUT_OF_ORDER'
  | 'COMPETING_STATES';

export type ConflictResolutionStatus =
  | 'UNRESOLVED'
  | 'RESOLVED_LATEST'
  | 'RESOLVED_MANUAL'
  | 'ACKNOWLEDGED';

export interface FeatureHistoryConflict {
  conflictId: string;
  featureId: string;
  conflictType: HistoryConflictType;
  competingEvents: string[];
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: FeatureHistoryConfidence;
  resolutionStatus: ConflictResolutionStatus;
  detectedAt: number;
}
