import type { FeatureBehavior } from './FeatureBehavior';
import type { FeatureBehaviorConflict } from './FeatureBehaviorConflict';

export interface FeatureBehaviorStatistics {
  flowsEvaluated: number;
  nodesCreated: number;
  edgesCreated: number;
  conflictsDetected: number;
  featuresAnalyzed: number;
  pathsComputed: number;
}

export interface FeatureBehaviorResult {
  runId: string;
  featureId?: string;
  flows?: any[];
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
  behaviors: FeatureBehavior[];
  newBehaviors: FeatureBehavior[];
  updatedBehaviors: FeatureBehavior[];
  staleBehaviors: FeatureBehavior[];
  conflicts: FeatureBehaviorConflict[];
  statistics: FeatureBehaviorStatistics;
  [key: string]: any;
}
