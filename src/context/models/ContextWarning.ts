export type ContextWarningType =
  | 'STALE_KNOWLEDGE'
  | 'BUDGET_EXCEEDED'
  | 'TRUNCATED_CONTENT'
  | 'OMITTED_SECTION'
  | 'UNRESOLVED_FEATURE'
  | 'VERSION_MISMATCH'
  | 'PARTIAL_PROVIDER_FAILURE'
  | 'LOW_CONFIDENCE'
  | 'CIRCULAR_DEPENDENCY'
  | 'DUPLICATE_RESOURCE';

export interface ContextWarning {
  type: ContextWarningType;
  message: string;
  section?: string | undefined;
  targetId?: string | undefined;
  details?: Record<string, any> | undefined;
}
