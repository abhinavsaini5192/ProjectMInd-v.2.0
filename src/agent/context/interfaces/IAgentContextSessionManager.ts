import type { AgentContextSession, CreateContextSessionParams } from '../models/AgentContextSession.js';
import type { AgentTask } from '../models/AgentTask.js';
import type { AgentContextState } from '../models/AgentContextState.js';
import type { ContextPackage } from '../../../context/models/ContextPackage.js';
import type { ContextDelta } from '../models/ContextDelta.js';
import type { ContextPin, CreatePinParams } from '../models/ContextPin.js';
import type { ContextFeedback, ContextFeedbackParams } from '../models/ContextFeedback.js';
import type { ContextRefreshReason } from '../models/ContextRefreshReason.js';
import type { AgentExecutionReport, AgentExecutionReportParams } from '../models/AgentExecutionReport.js';
import type { InvalidationEvaluationResult } from './IAgentContextInvalidator.js';
import type { RefreshContextOptions, RefreshContextResult } from './IAgentContextRefresher.js';

export interface StartTaskContextResult {
  readonly task: AgentTask;
  readonly contextSession: AgentContextSession;
  readonly contextPackage: ContextPackage;
  readonly warnings: readonly string[];
  readonly freshness: string;
  readonly versionMetadata: {
    readonly contextVersion: number;
    readonly knowledgeVersion: string;
  };
}

export interface GetCurrentContextOptions {
  readonly includeDelta?: boolean | undefined;
  readonly baseContextVersion?: number | undefined;
  readonly autoRefreshIfStale?: boolean | undefined;
}

export interface GetCurrentContextResult {
  readonly contextSession: AgentContextSession;
  readonly contextPackage: ContextPackage;
  readonly contextVersion: number;
  readonly freshness: string;
  readonly wasRefreshed: boolean;
  readonly delta?: ContextDelta | undefined;
  readonly warnings: readonly string[];
}

export interface UpdateTaskContextParams {
  readonly newTaskText?: string | undefined;
  readonly newIntent?: string | undefined;
  readonly newTitle?: string | undefined;
  readonly featureIds?: readonly string[] | undefined;
  readonly tokenBudget?: number | undefined;
}

export interface ScopeValidationParams {
  readonly workspaceId?: string | undefined;
  readonly repositoryId?: string | undefined;
  readonly agentSessionId?: string | undefined;
}

export interface ExecutionReportResult {
  readonly report: AgentExecutionReport;
  readonly invalidation: InvalidationEvaluationResult;
  readonly contextSession: AgentContextSession;
  readonly isStale: boolean;
}

export interface IAgentContextSessionManager {
  // Session & Task Lifecycle
  startTaskContext(params: CreateContextSessionParams): Promise<StartTaskContextResult>;
  createContextSession(params: CreateContextSessionParams): Promise<StartTaskContextResult>;
  getContextSession(contextSessionId: string, scope?: ScopeValidationParams): Promise<AgentContextSession | undefined>;
  getTask(taskId: string, scope?: ScopeValidationParams): Promise<AgentTask | undefined>;
  getTaskForContextSession(contextSessionId: string, scope?: ScopeValidationParams): Promise<AgentTask | undefined>;
  updateContextSession(
    contextSessionId: string,
    updates: Partial<Pick<AgentContextSession, 'status' | 'metadata'>>,
    scope?: ScopeValidationParams
  ): Promise<AgentContextSession>;
  pauseContextSession(contextSessionId: string, scope?: ScopeValidationParams): Promise<AgentContextSession>;
  resumeContextSession(contextSessionId: string, scope?: ScopeValidationParams): Promise<AgentContextSession>;
  completeContextSession(contextSessionId: string, scope?: ScopeValidationParams): Promise<AgentContextSession>;
  cancelContextSession(contextSessionId: string, reason?: string | undefined, scope?: ScopeValidationParams): Promise<AgentContextSession>;
  markContextStale(contextSessionId: string, reason: ContextRefreshReason, scope?: ScopeValidationParams): Promise<void>;

  // Context Operations
  getCurrentContext(contextSessionId: string, options?: GetCurrentContextOptions, scope?: ScopeValidationParams): Promise<GetCurrentContextResult>;
  refreshContextSession(contextSessionId: string, options?: RefreshContextOptions, scope?: ScopeValidationParams): Promise<RefreshContextResult>;
  updateTaskContext(contextSessionId: string, params: UpdateTaskContextParams, scope?: ScopeValidationParams): Promise<GetCurrentContextResult>;

  // Execution & Invalidation
  reportExecution(params: AgentExecutionReportParams, scope?: ScopeValidationParams): Promise<ExecutionReportResult>;

  // Pinning
  pinContext(contextSessionId: string, params: Omit<CreatePinParams, 'contextSessionId'>, scope?: ScopeValidationParams): Promise<ContextPin>;
  unpinContext(contextSessionId: string, pinId: string, scope?: ScopeValidationParams): Promise<boolean>;
  listPinnedContext(contextSessionId: string, scope?: ScopeValidationParams): Promise<readonly ContextPin[]>;

  // Feedback
  recordFeedback(params: ContextFeedbackParams, scope?: ScopeValidationParams): Promise<ContextFeedback>;
  getContextState(contextSessionId: string, scope?: ScopeValidationParams): Promise<AgentContextState | undefined>;
}
