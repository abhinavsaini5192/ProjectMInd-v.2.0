export type ObservationRetentionCategory =
  | 'EPHEMERAL'
  | 'TASK_SCOPED'
  | 'SESSION_SCOPED'
  | 'PROJECT_RELEVANT'
  | 'HISTORICAL';

export const OBSERVATION_RETENTION_CATEGORIES: readonly ObservationRetentionCategory[] = [
  'EPHEMERAL',
  'TASK_SCOPED',
  'SESSION_SCOPED',
  'PROJECT_RELEVANT',
  'HISTORICAL',
] as const;
