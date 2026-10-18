export type ScopeLevel =
  | 'RESOURCE'
  | 'SYMBOL'
  | 'FILE'
  | 'MODULE'
  | 'FEATURE'
  | 'PROJECT'
  | 'REPOSITORY'
  | 'WORKSPACE'
  | 'TASK_TYPE'
  | 'AGENT_ROLE'
  | 'CONTEXT_TYPE'
  | 'RETRIEVAL_TYPE'
  | 'PLAN_TYPE'
  | 'GLOBAL';

export interface LearningScopeRef {
  readonly level: ScopeLevel;
  readonly value: string;
  readonly workspaceId: string;
  readonly projectId?: string | undefined;
  readonly repositoryId?: string | undefined;
}

export const SCOPE_HIERARCHY: Record<ScopeLevel, number> = {
  SYMBOL: 1,
  RESOURCE: 2,
  FILE: 3,
  MODULE: 4,
  FEATURE: 5,
  TASK_TYPE: 6,
  AGENT_ROLE: 6,
  CONTEXT_TYPE: 6,
  RETRIEVAL_TYPE: 6,
  PLAN_TYPE: 6,
  REPOSITORY: 7,
  PROJECT: 8,
  WORKSPACE: 9,
  GLOBAL: 10,
};
