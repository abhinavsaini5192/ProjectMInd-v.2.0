export type AgentAdapterStatus =
  | 'UNINITIALIZED'
  | 'INITIALIZING'
  | 'READY'
  | 'DEGRADED'
  | 'FAILED'
  | 'SHUTTING_DOWN'
  | 'STOPPED';

export const AGENT_ADAPTER_STATUSES: readonly AgentAdapterStatus[] = [
  'UNINITIALIZED',
  'INITIALIZING',
  'READY',
  'DEGRADED',
  'FAILED',
  'SHUTTING_DOWN',
  'STOPPED',
] as const;
