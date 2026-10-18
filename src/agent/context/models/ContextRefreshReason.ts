export type ContextRefreshReason =
  | 'TASK_CHANGED'
  | 'RESOURCE_CHANGED'
  | 'FEATURE_CHANGED'
  | 'DEPENDENCY_CHANGED'
  | 'BEHAVIOR_CHANGED'
  | 'HEALTH_CHANGED'
  | 'IMPACT_CHANGED'
  | 'KNOWLEDGE_UPDATED'
  | 'EXPLICIT_REQUEST'
  | 'STALE_CONTEXT'
  | 'CONTEXT_INVALIDATED'
  | 'UNKNOWN';

export const CONTEXT_REFRESH_REASONS: readonly ContextRefreshReason[] = [
  'TASK_CHANGED',
  'RESOURCE_CHANGED',
  'FEATURE_CHANGED',
  'DEPENDENCY_CHANGED',
  'BEHAVIOR_CHANGED',
  'HEALTH_CHANGED',
  'IMPACT_CHANGED',
  'KNOWLEDGE_UPDATED',
  'EXPLICIT_REQUEST',
  'STALE_CONTEXT',
  'CONTEXT_INVALIDATED',
  'UNKNOWN',
] as const;

export function isContextRefreshReason(value: unknown): value is ContextRefreshReason {
  return typeof value === 'string' && CONTEXT_REFRESH_REASONS.includes(value as ContextRefreshReason);
}
