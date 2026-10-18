import type { FeatureKnowledgeSection } from './FeatureKnowledgeSection.js';

export type CompletenessStatus =
  | 'COMPLETE'
  | 'MOSTLY_COMPLETE'
  | 'PARTIAL'
  | 'MINIMAL'
  | 'UNKNOWN';

export interface FeatureKnowledgeCompleteness {
  requestedSections: FeatureKnowledgeSection[];
  availableSections: FeatureKnowledgeSection[];
  unavailableSections: FeatureKnowledgeSection[];
  staleSections: FeatureKnowledgeSection[];
  failedSections: FeatureKnowledgeSection[];
  notComputedSections: FeatureKnowledgeSection[];
  completenessRatio: number; // 0 to 1
  status: CompletenessStatus;
  missingKnowledgeReasons: Record<string, string>;
}
