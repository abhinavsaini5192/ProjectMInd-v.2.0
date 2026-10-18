import type { FeatureHistoryConfidence } from './FeatureHistoryConfidence.js';

export interface ResourceSummary {
  resourceCount: number;
  resources: string[];
  symbolCount?: number | undefined;
  moduleCount?: number | undefined;
}

export interface MappingSummary {
  mappedCount: number;
  primaryPath?: string | undefined;
  roles: Record<string, number>;
}

export interface DependencySummary {
  dependencyCount: number;
  dependentCount: number;
  dependencies: string[];
  dependents: string[];
}

export interface BehaviorSummary {
  flowCount: number;
  entryPointCount: number;
  flows: string[];
  entryPoints: string[];
}

export interface HealthSummary {
  score: number;
  status: string;
  dimensions?: Record<string, number> | undefined;
}

export interface RiskSummary {
  score: number;
  riskCount: number;
  topRisks?: string[] | undefined;
}

export interface CriticalitySummary {
  score: number;
  level: string;
}

export interface ArchitectureSummary {
  patterns?: string[] | undefined;
  layer?: string | undefined;
}

export interface FeatureSnapshot {
  snapshotId: string;
  featureId: string;
  timestamp: number;
  version: number;
  metadata: Record<string, any>;
  resourceSummary: ResourceSummary;
  mappingSummary: MappingSummary;
  dependencySummary: DependencySummary;
  behaviorSummary: BehaviorSummary;
  healthSummary: HealthSummary;
  riskSummary: RiskSummary;
  criticalitySummary: CriticalitySummary;
  architectureSummary: ArchitectureSummary;
  status: string;
  confidence: FeatureHistoryConfidence;
  knowledgeVersion: string;
}
