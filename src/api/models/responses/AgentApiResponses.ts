import type { AgentSession } from '../../../agent/models/AgentSession.js';
import type { AgentTask } from '../../../agent/models/AgentTask.js';
import type { AgentContextSession } from '../../../agent/context/models/AgentContextSession.js';

export interface AgentSessionResponse {
  readonly session: AgentSession;
}

export interface AgentSessionListResponse {
  readonly sessions: readonly AgentSession[];
}

export interface AgentTaskResponse {
  readonly task: AgentTask;
}

export interface AgentContextSessionResponse {
  readonly contextSession: AgentContextSession;
}
