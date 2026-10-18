import type { FeatureHistory } from '../models/FeatureHistory.js';
import type { FeatureSnapshot } from '../models/FeatureSnapshot.js';
import type { FeatureEvolutionSummary } from '../models/FeatureEvolutionSummary.js';
import type { FeatureComparison } from '../models/FeatureComparison.js';

export interface IFeatureHistoryExplainer {
  explainEvolution(featureId: string, history: FeatureHistory): FeatureEvolutionSummary;
  explainCriticalityChange(featureId: string, history: FeatureHistory): string;
  explainRiskChange(featureId: string, history: FeatureHistory): string;
  compareSnapshots(
    featureId: string,
    before: FeatureSnapshot,
    after: FeatureSnapshot
  ): FeatureComparison;
}
