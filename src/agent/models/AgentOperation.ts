/**
 * Supported Agent Operation Types in ProjectMind Phase 7.1.
 */
export type AgentOperationType =
  | 'GET_CONTEXT'
  | 'GET_FEATURE'
  | 'GET_FEATURE_CONTEXT'
  | 'GET_IMPACT'
  | 'GET_ARCHITECTURE'
  | 'GET_HISTORY'
  | 'GET_HEALTH'
  | 'EXPLAIN_CONTEXT'
  | 'REFRESH_CONTEXT'
  | 'REPORT_EXECUTION'
  | 'REPORT_VERIFICATION'
  | 'UPDATE_KNOWLEDGE'
  // Phase 7.4 Context Operations
  | 'START_TASK_CONTEXT'
  | 'GET_CURRENT_CONTEXT'
  | 'REFRESH_TASK_CONTEXT'
  | 'UPDATE_TASK_CONTEXT'
  | 'PIN_CONTEXT'
  | 'UNPIN_CONTEXT'
  | 'REPORT_CONTEXT_FEEDBACK'
  // Phase 7.5 Task Runtime Operations
  | 'START_TASK'
  | 'GET_TASK'
  | 'GET_TASK_STATE'
  | 'GET_TASK_PROGRESS'
  | 'UPDATE_TASK'
  | 'COMPLETE_TASK'
  | 'RESUME_TASK'
  | 'CANCEL_TASK'
  // Phase 7.6 Execution Observation Operations
  | 'GET_EXECUTION_OBSERVATIONS'
  | 'GET_TASK_TIMELINE'
  | 'GET_EXECUTION_SUMMARY'
  | 'GET_OBSERVATION_CONFLICTS'
  // Phase 7.7 Verification Integration Operations
  | 'GET_VERIFICATION'
  | 'GET_VERIFICATION_SUMMARY'
  | 'GET_VERIFICATION_TIMELINE'
  | 'GET_COMPLETION_EVIDENCE'
  | 'GET_VERIFICATION_CONFLICTS';


export type AgentOperationStatus = 'PENDING' | 'EXECUTING' | 'COMPLETED' | 'FAILED';

/**
 * Audit record or execution status for an agent operation.
 */
export interface AgentOperationRecord {
  readonly operationId: string;
  readonly type: AgentOperationType;
  readonly agentId: string;
  readonly sessionId?: string | undefined;
  readonly status: AgentOperationStatus;
  readonly startedAt: string;
  readonly completedAt?: string | undefined;
  readonly durationMs?: number | undefined;
  readonly error?: string | undefined;
}
