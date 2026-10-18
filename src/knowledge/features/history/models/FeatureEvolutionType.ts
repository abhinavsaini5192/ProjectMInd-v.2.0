export type FeatureEvolutionType =
  | 'CREATION'
  | 'DISCOVERY'
  | 'STRUCTURAL'
  | 'BEHAVIORAL'
  | 'DEPENDENCY'
  | 'API'
  | 'DATA'
  | 'INTEGRATION'
  | 'SECURITY'
  | 'HEALTH'
  | 'RISK'
  | 'ARCHITECTURAL'
  | 'MATURITY'
  | 'STATUS'
  | 'DEPRECATION'
  | 'REGRESSION'
  | 'STABILIZATION'
  | 'TECHNICAL'
  | 'UNKNOWN';

export const FEATURE_EVOLUTION_TYPES: readonly FeatureEvolutionType[] = [
  'CREATION',
  'DISCOVERY',
  'STRUCTURAL',
  'BEHAVIORAL',
  'DEPENDENCY',
  'API',
  'DATA',
  'INTEGRATION',
  'SECURITY',
  'HEALTH',
  'RISK',
  'ARCHITECTURAL',
  'MATURITY',
  'STATUS',
  'DEPRECATION',
  'REGRESSION',
  'STABILIZATION',
  'TECHNICAL',
  'UNKNOWN',
] as const;

export function isFeatureEvolutionType(value: unknown): value is FeatureEvolutionType {
  return typeof value === 'string' && FEATURE_EVOLUTION_TYPES.includes(value as FeatureEvolutionType);
}
