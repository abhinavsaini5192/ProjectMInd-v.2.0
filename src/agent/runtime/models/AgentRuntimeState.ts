export type AgentRuntimeState =
  | 'CREATED'
  | 'INITIALIZING'
  | 'READY'
  | 'RUNNING'
  | 'PAUSED'
  | 'DEGRADED'
  | 'RECOVERING'
  | 'STOPPING'
  | 'STOPPED'
  | 'FAILED';

export const AGENT_RUNTIME_STATES: readonly AgentRuntimeState[] = [
  'CREATED',
  'INITIALIZING',
  'READY',
  'RUNNING',
  'PAUSED',
  'DEGRADED',
  'RECOVERING',
  'STOPPING',
  'STOPPED',
  'FAILED',
] as const;

export function isAgentRuntimeState(value: unknown): value is AgentRuntimeState {
  return typeof value === 'string' && AGENT_RUNTIME_STATES.includes(value as AgentRuntimeState);
}
