import type { AgentRuntimeState } from '../models/AgentRuntimeState.js';
import type { AgentRuntimeHealth } from '../models/AgentRuntimeHealth.js';

export const AgentRuntimeEvents = {
  RUNTIME_STARTED: 'agent.runtime.started',
  RUNTIME_READY: 'agent.runtime.ready',
  RUNTIME_PAUSED: 'agent.runtime.paused',
  RUNTIME_RESUMED: 'agent.runtime.resumed',
  RUNTIME_STOPPING: 'agent.runtime.stopping',
  RUNTIME_STOPPED: 'agent.runtime.stopped',
  RUNTIME_FAILED: 'agent.runtime.failed',
  RUNTIME_RECOVERING: 'agent.runtime.recovering',
  RUNTIME_RECOVERED: 'agent.runtime.recovered',
  RUNTIME_DEGRADED: 'agent.runtime.degraded',
  RUNTIME_CHECKPOINT_CREATED: 'agent.runtime.checkpoint_created',
  RUNTIME_CHECKPOINT_RESTORED: 'agent.runtime.checkpoint_restored',
  RUNTIME_HEALTH_CHANGED: 'agent.runtime.health_changed',
  RUNTIME_CAPACITY_WARNING: 'agent.runtime.capacity_warning',
} as const;

export type AgentRuntimeEventType = (typeof AgentRuntimeEvents)[keyof typeof AgentRuntimeEvents];

export interface AgentRuntimeLifecycleEventPayload {
  readonly previousState: AgentRuntimeState;
  readonly currentState: AgentRuntimeState;
  readonly timestamp: string;
  readonly reason?: string | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
}

export interface AgentRuntimeHealthEventPayload {
  readonly previousStatus: string;
  readonly currentStatus: string;
  readonly health: AgentRuntimeHealth;
  readonly timestamp: string;
}

export interface AgentRuntimeCheckpointEventPayload {
  readonly checkpointId: string;
  readonly runtimeState: AgentRuntimeState;
  readonly sessionCount: number;
  readonly taskCount: number;
  readonly timestamp: string;
}

export interface AgentRuntimeCapacityEventPayload {
  readonly resourceType: 'SESSIONS' | 'TASKS' | 'PAYLOAD_SIZE' | 'CALL_RATE';
  readonly limit: number;
  readonly current: number;
  readonly utilizationPercentage: number;
  readonly timestamp: string;
}
