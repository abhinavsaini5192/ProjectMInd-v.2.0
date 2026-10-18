export interface FeatureKnowledgeSummary {
  featureId: string;
  name: string;
  type: string;
  status: string;
  description: string;
  mappedResourceCount: number;
  dependencyCount: number;
  dependentCount: number;
  flowCount: number;
  healthScore: number;
  riskScore: number;
  criticalityLevel: string;
  maturityLevel: string;
  keyRisks: string[];
  recentMilestones: string[];
}
