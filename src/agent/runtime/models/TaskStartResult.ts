import type { AgentTask, AgentTaskStatus } from '../../context/models/AgentTask.js';
import type { AgentContextSession } from '../../context/models/AgentContextSession.js';
import type { ContextPackage } from '../../../context/models/ContextPackage.js';

export interface TaskStartResult {
  readonly task: AgentTask;
  readonly contextSession: AgentContextSession;
  readonly contextPackage: ContextPackage;
  readonly state: AgentTaskStatus;
  readonly warnings: readonly string[];
  readonly freshness: string;
  readonly contextVersion: number;
  readonly knowledgeVersion?: number | undefined;
}
