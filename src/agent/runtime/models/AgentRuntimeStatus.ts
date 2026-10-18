import type { AgentRuntimeState } from './AgentRuntimeState.js';

export interface AgentRuntimeStatus {
  readonly runtimeId: string;
  readonly workspaceId: string;
  readonly repositoryId: string;
  readonly adapterId?: string | undefined;
  readonly protocol?: string | undefined;
  readonly state: AgentRuntimeState;
  readonly runtimeVersion: string;
  readonly activeSessionsCount: number;
  readonly activeTasksCount: number;
  readonly currentKnowledgeVersion?: string | undefined;
  readonly currentContextVersion?: string | undefined;
  readonly degradedSubsystems: readonly string[];
  readonly uptimeMs: number;
  readonly startedAt?: number | undefined;
  readonly stoppedAt?: number | undefined;
}
