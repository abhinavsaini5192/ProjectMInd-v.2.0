export type RuntimeRecoveryStatus =
  | 'NOT_REQUIRED'
  | 'PENDING'
  | 'RECOVERING'
  | 'RECOVERED'
  | 'PARTIALLY_RECOVERED'
  | 'FAILED'
  | 'MANUAL_INTERVENTION_REQUIRED';

export interface AgentRuntimeRecoveryState {
  readonly status: RuntimeRecoveryStatus;
  readonly checkpointId?: string | undefined;
  readonly recoveredSessionsCount: number;
  readonly recoveredTasksCount: number;
  readonly contextRefreshed: boolean;
  readonly knowledgeVersionAligned: boolean;
  readonly details?: string | undefined;
  readonly error?: string | undefined;
  readonly completedAt?: number | undefined;
}
