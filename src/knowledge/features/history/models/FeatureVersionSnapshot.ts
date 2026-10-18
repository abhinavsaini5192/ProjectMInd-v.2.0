import type { FeatureSnapshot } from './FeatureSnapshot.js';

export interface FeatureVersionSnapshot {
  versionId: string;
  featureId: string;
  semanticVersion: number;
  snapshotId: string;
  snapshot: FeatureSnapshot;
  reason: string;
  triggerEvolutionId?: string | undefined;
  timestamp: number;
  isMajor: boolean;
}
