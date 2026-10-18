export interface FeatureKnowledgeContextPackage {
  featureId: string;
  name: string;
  description: string;
  identity: Record<string, any>;
  entryPoints: string[];
  primaryResources: string[];
  directDependencies: string[];
  importantDependents: string[];
  primaryFlows: string[];
  highSeverityRisks: string[];
  healthSummary: Record<string, any>;
  recentHistory: string[];
  impactSummary: Record<string, any>;
  estimatedTokens: number;
  completeness: string;
  confidence: number;
}
