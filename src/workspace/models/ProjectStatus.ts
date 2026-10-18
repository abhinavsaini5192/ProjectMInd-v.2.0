export type ProjectStatusType =
  | 'CREATED'
  | 'INITIALIZING'
  | 'ACTIVE'
  | 'PAUSED'
  | 'ARCHIVED'
  | 'COMPLETED';

export const VALID_PROJECT_TRANSITIONS: Readonly<Record<ProjectStatusType, readonly ProjectStatusType[]>> = {
  CREATED: ['INITIALIZING', 'ACTIVE', 'ARCHIVED'],
  INITIALIZING: ['ACTIVE', 'CREATED', 'ARCHIVED'],
  ACTIVE: ['PAUSED', 'ARCHIVED', 'COMPLETED', 'INITIALIZING'],
  PAUSED: ['ACTIVE', 'ARCHIVED'],
  ARCHIVED: ['ACTIVE'],
  COMPLETED: ['ACTIVE', 'ARCHIVED'],
};

export function isValidProjectTransition(current: ProjectStatusType, target: ProjectStatusType): boolean {
  const allowed = VALID_PROJECT_TRANSITIONS[current];
  return allowed ? allowed.includes(target) : false;
}
