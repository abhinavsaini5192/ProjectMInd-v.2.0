export type VerificationScopeType =
  | 'TASK'
  | 'FEATURE'
  | 'RESOURCE'
  | 'FILE'
  | 'SYMBOL'
  | 'MODULE'
  | 'REPOSITORY'
  | 'WORKSPACE'
  | 'UNKNOWN';

export interface VerificationScopeDefinition {
  readonly scopeType: VerificationScopeType;
  readonly targetIds?: readonly string[] | undefined;
  readonly targetFiles?: readonly string[] | undefined;
  readonly featureIds?: readonly string[] | undefined;
  readonly symbolNames?: readonly string[] | undefined;
}

export const DEFAULT_TASK_SCOPE: VerificationScopeDefinition = {
  scopeType: 'TASK',
  targetIds: [],
  targetFiles: [],
};
