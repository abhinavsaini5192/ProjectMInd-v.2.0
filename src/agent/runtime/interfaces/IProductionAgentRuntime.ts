import type { Agent } from '../../models/Agent.js';
import type { AgentSession, AgentSessionCreateParams } from '../../models/AgentSession.js';
import type { AgentTask } from '../../context/models/AgentTask.js';
import type { TaskStartResult } from '../models/TaskStartResult.js';
import type { StartTaskParams, CompleteTaskParams, CancelTaskParams } from './ITaskRuntime.js';
import type { ScopeValidationParams } from './ITaskExecutionCoordinator.js';
import type { ToolRequest } from '../../protocol/models/ToolRequest.js';
import type { ToolResponse } from '../../protocol/models/ToolResponse.js';
import type {
  GetCurrentContextOptions,
  GetCurrentContextResult,
} from '../../context/interfaces/IAgentContextSessionManager.js';
import type {
  RefreshContextOptions,
  RefreshContextResult,
} from '../../context/interfaces/IAgentContextRefresher.js';
import type { AgentRuntimeState } from '../models/AgentRuntimeState.js';
import type { AgentRuntimeStatus } from '../models/AgentRuntimeStatus.js';
import type { AgentRuntimeHealth } from '../models/AgentRuntimeHealth.js';
import type { AgentRuntimeMetrics } from '../models/AgentRuntimeMetrics.js';
import type { AgentRuntimeCapabilities } from '../models/AgentRuntimeCapabilities.js';
import type { AgentRuntimeCheckpoint } from '../models/AgentRuntimeCheckpoint.js';
import type { AgentRuntimeRecoveryState } from '../models/AgentRuntimeRecoveryState.js';
import type { SessionScopeParams } from './IAgentSessionCoordinator.js';

export interface IProductionAgentRuntime {
  // Lifecycle
  initialize(): Promise<void>;
  start(): Promise<void>;
  pause(reason?: string): Promise<void>;
  resume(): Promise<void>;
  stop(reason?: string): Promise<void>;
  getState(): AgentRuntimeState;
  getStatus(): Promise<AgentRuntimeStatus>;
  getHealth(): Promise<AgentRuntimeHealth>;
  getMetrics(): AgentRuntimeMetrics;
  getCapabilities(): AgentRuntimeCapabilities;

  // Sessions
  createSession(params: AgentSessionCreateParams, agent: Agent): Promise<AgentSession>;
  getSession(sessionId: string, scope?: SessionScopeParams): Promise<AgentSession | undefined>;
  terminateSession(sessionId: string, scope?: SessionScopeParams): Promise<void>;
  listActiveSessions(workspaceId?: string): Promise<readonly AgentSession[]>;

  // Tasks
  submitTask(params: StartTaskParams, scope: ScopeValidationParams): Promise<TaskStartResult>;
  getTask(taskId: string, scope: ScopeValidationParams): Promise<AgentTask | undefined>;
  cancelTask(params: CancelTaskParams, scope: ScopeValidationParams): Promise<AgentTask>;
  completeTask(params: CompleteTaskParams, scope: ScopeValidationParams): Promise<AgentTask>;

  // Context
  getContext(
    contextSessionId: string,
    options?: GetCurrentContextOptions,
    scope?: ScopeValidationParams
  ): Promise<GetCurrentContextResult>;
  refreshContext(
    contextSessionId: string,
    options?: RefreshContextOptions,
    scope?: ScopeValidationParams
  ): Promise<RefreshContextResult>;

  // Tools
  executeTool(request: ToolRequest, session?: AgentSession | undefined): Promise<ToolResponse>;

  // Resiliency & Snapshots
  createCheckpoint(label?: string): Promise<AgentRuntimeCheckpoint>;
  restoreCheckpoint(checkpointId: string): Promise<AgentRuntimeRecoveryState>;
  recover(checkpointId?: string): Promise<AgentRuntimeRecoveryState>;
}
