export type ContextSection =
  | 'IDENTITY'
  | 'RESOURCES'
  | 'ENTRY_POINTS'
  | 'BEHAVIOR'
  | 'DEPENDENCIES'
  | 'TESTS'
  | 'HEALTH'
  | 'IMPACT'
  | 'HISTORY'
  | 'ARCHITECTURE'
  | 'METADATA'
  | 'WARNINGS'
  | 'EXPLANATIONS';

export const CONTEXT_SECTIONS: readonly ContextSection[] = [
  'IDENTITY',
  'RESOURCES',
  'ENTRY_POINTS',
  'BEHAVIOR',
  'DEPENDENCIES',
  'TESTS',
  'HEALTH',
  'IMPACT',
  'HISTORY',
  'ARCHITECTURE',
  'METADATA',
  'WARNINGS',
  'EXPLANATIONS',
] as const;

export function isContextSection(value: unknown): value is ContextSection {
  return typeof value === 'string' && CONTEXT_SECTIONS.includes(value as ContextSection);
}
