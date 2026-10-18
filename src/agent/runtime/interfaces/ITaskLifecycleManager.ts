import type { AgentTask, AgentTaskStatus } from '../../context/models/AgentTask.js';

export interface TransitionTaskParams {
  readonly taskId: string;
  readonly targetState: AgentTaskStatus;
  readonly reason?: string | undefined;
  readonly actor?: string | undefined;
  readonly expectedVersion?: number | undefined;
  readonly contextSessionId?: string | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
}

export interface ITaskLifecycleManager {
  transition(params: TransitionTaskParams): Promise<AgentTask>;
  start(taskId: string, actor: string, expectedVersion?: number | undefined): Promise<AgentTask>;
  block(taskId: string, reason: string, actor: string, expectedVersion?: number | undefined): Promise<AgentTask>;
  resume(taskId: string, actor: string, expectedVersion?: number | undefined): Promise<AgentTask>;
  verify(taskId: string, actor: string, expectedVersion?: number | undefined): Promise<AgentTask>;
  complete(taskId: string, actor: string, expectedVersion?: number | undefined): Promise<AgentTask>;
  fail(taskId: string, reason: string, actor: string, expectedVersion?: number | undefined): Promise<AgentTask>;
  cancel(taskId: string, reason: string, actor: string, expectedVersion?: number | undefined): Promise<AgentTask>;
}
