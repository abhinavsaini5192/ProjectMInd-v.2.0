export type FeatureKnowledgeSection =
  | 'IDENTITY'
  | 'METADATA'
  | 'MAPPINGS'
  | 'DEPENDENCIES'
  | 'DEPENDENTS'
  | 'RELATIONSHIPS'
  | 'ENTRY_POINTS'
  | 'BEHAVIOR'
  | 'FLOWS'
  | 'HEALTH'
  | 'RISKS'
  | 'IMPACT'
  | 'HISTORY'
  | 'MILESTONES'
  | 'TRENDS'
  | 'MATURITY'
  | 'ARCHITECTURE'
  | 'SUMMARY'
  | 'EXPLANATION'
  | 'REFERENCES'
  | 'CONTEXT';

export const FEATURE_KNOWLEDGE_SECTIONS: readonly FeatureKnowledgeSection[] = [
  'IDENTITY',
  'METADATA',
  'MAPPINGS',
  'DEPENDENCIES',
  'DEPENDENTS',
  'RELATIONSHIPS',
  'ENTRY_POINTS',
  'BEHAVIOR',
  'FLOWS',
  'HEALTH',
  'RISKS',
  'IMPACT',
  'HISTORY',
  'MILESTONES',
  'TRENDS',
  'MATURITY',
  'ARCHITECTURE',
  'SUMMARY',
  'EXPLANATION',
  'REFERENCES',
  'CONTEXT',
] as const;

export function isFeatureKnowledgeSection(value: unknown): value is FeatureKnowledgeSection {
  return typeof value === 'string' && FEATURE_KNOWLEDGE_SECTIONS.includes(value as FeatureKnowledgeSection);
}

export type SectionStatus =
  | 'AVAILABLE'
  | 'EMPTY'
  | 'NOT_REQUESTED'
  | 'NOT_COMPUTED'
  | 'STALE'
  | 'PARTIAL'
  | 'FAILED'
  | 'INACCESSIBLE'
  | 'UNKNOWN';

export const SECTION_STATUSES: readonly SectionStatus[] = [
  'AVAILABLE',
  'EMPTY',
  'NOT_REQUESTED',
  'NOT_COMPUTED',
  'STALE',
  'PARTIAL',
  'FAILED',
  'INACCESSIBLE',
  'UNKNOWN',
] as const;

export function isSectionStatus(value: unknown): value is SectionStatus {
  return typeof value === 'string' && SECTION_STATUSES.includes(value as SectionStatus);
}
