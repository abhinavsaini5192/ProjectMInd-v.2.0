import type { Agent } from '../../models/Agent.js';
import type { AgentSession, AgentSessionCreateParams } from '../../models/AgentSession.js';
import type { AgentTask } from '../../context/models/AgentTask.js';
import type { TaskStartResult } from '../models/TaskStartResult.js';
import type { StartTaskParams, CompleteTaskParams, CancelTaskParams } from '../interfaces/ITaskRuntime.js';
import type { ScopeValidationParams } from '../interfaces/ITaskExecutionCoordinator.js';
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
import type { SessionScopeParams } from '../interfaces/IAgentSessionCoordinator.js';
import type { IProductionAgentRuntime } from '../interfaces/IProductionAgentRuntime.js';
import type { IAgentRuntimeCoordinator } from '../interfaces/IAgentRuntimeCoordinator.js';
import { RuntimeNotReadyError } from '../errors/AgentRuntimeError.js';

export class ProductionAgentRuntime implements IProductionAgentRuntime {
  constructor(private readonly coordinator: IAgentRuntimeCoordinator) {}

  // ---------------------------------------------------------------------------
  // Lifecycle & Status
  // ---------------------------------------------------------------------------

  public async initialize(): Promise<void> {
    await this.coordinator.lifecycle.initialize();
  }

  public async start(): Promise<void> {
    await this.coordinator.lifecycle.start();
  }

  public async pause(reason?: string): Promise<void> {
    await this.coordinator.lifecycle.pause(reason);
  }

  public async resume(): Promise<void> {
    await this.coordinator.lifecycle.resume();
  }

  public async stop(reason?: string): Promise<void> {
    await this.coordinator.lifecycle.stop(reason);
  }

  public getState(): AgentRuntimeState {
    return this.coordinator.lifecycle.getState();
  }

  public async getStatus(): Promise<AgentRuntimeStatus> {
    return this.coordinator.getStatus();
  }

  public async getHealth(): Promise<AgentRuntimeHealth> {
    return this.coordinator.health.getHealth();
  }

  public getMetrics(): AgentRuntimeMetrics {
    return this.coordinator.telemetry.getMetrics();
  }

  public getCapabilities(): AgentRuntimeCapabilities {
    return this.coordinator.config.capabilities;
  }

  // ---------------------------------------------------------------------------
  // Sessions
  // ---------------------------------------------------------------------------

  public async createSession(params: AgentSessionCreateParams, agent: Agent): Promise<AgentSession> {
    this.assertOperational('createSession');
    return this.coordinator.sessions.createSession(params, agent);
  }

  public async getSession(sessionId: string, scope?: SessionScopeParams): Promise<AgentSession | undefined> {
    this.assertOperational('getSession');
    return this.coordinator.sessions.getSession(sessionId, scope);
  }

  public async terminateSession(sessionId: string, scope?: SessionScopeParams): Promise<void> {
    this.assertOperational('terminateSession');
    return this.coordinator.sessions.terminateSession(sessionId, scope);
  }

  public async listActiveSessions(workspaceId?: string): Promise<readonly AgentSession[]> {
    this.assertOperational('listActiveSessions');
    return this.coordinator.sessions.listActiveSessions(workspaceId);
  }

  // ---------------------------------------------------------------------------
  // Tasks
  // ---------------------------------------------------------------------------

  public async submitTask(params: StartTaskParams, scope: ScopeValidationParams): Promise<TaskStartResult> {
    this.assertOperational('submitTask');
    return this.coordinator.tasks.submitTask(params, scope);
  }

  public async getTask(taskId: string, scope: ScopeValidationParams): Promise<AgentTask | undefined> {
    this.assertOperational('getTask');
    return this.coordinator.tasks.getTask(taskId, scope);
  }

  public async cancelTask(params: CancelTaskParams, scope: ScopeValidationParams): Promise<AgentTask> {
    this.assertOperational('cancelTask');
    return this.coordinator.tasks.cancelTask(params, scope);
  }

  public async completeTask(params: CompleteTaskParams, scope: ScopeValidationParams): Promise<AgentTask> {
    this.assertOperational('completeTask');
    return this.coordinator.tasks.completeTask(params, scope);
  }

  // ---------------------------------------------------------------------------
  // Context
  // ---------------------------------------------------------------------------

  public async getContext(
    contextSessionId: string,
    options?: GetCurrentContextOptions,
    scope?: ScopeValidationParams
  ): Promise<GetCurrentContextResult> {
    this.assertOperational('getContext');
    return this.coordinator.context.getContext(contextSessionId, options, scope);
  }

  public async refreshContext(
    contextSessionId: string,
    options?: RefreshContextOptions,
    scope?: ScopeValidationParams
  ): Promise<RefreshContextResult> {
    this.assertOperational('refreshContext');
    return this.coordinator.context.refreshContext(contextSessionId, options, scope);
  }

  // ---------------------------------------------------------------------------
  // Tool Execution
  // ---------------------------------------------------------------------------

  public async executeTool(request: ToolRequest, session?: AgentSession | undefined): Promise<ToolResponse> {
    this.assertOperational('executeTool');
    const startTime = Date.now();
    const response = await this.coordinator.tools.executeTool(request, session);
    const durationMs = Date.now() - startTime;

    // Record observation asynchronously
    void this.coordinator.observation.recordToolObservation(request, response, durationMs);

    return response;
  }

  // ---------------------------------------------------------------------------
  // Resiliency & Snapshots
  // ---------------------------------------------------------------------------

  public async createCheckpoint(label?: string): Promise<AgentRuntimeCheckpoint> {
    return this.coordinator.checkpoints.createCheckpoint(label);
  }

  public async restoreCheckpoint(checkpointId: string): Promise<AgentRuntimeRecoveryState> {
    return this.coordinator.checkpoints.restoreCheckpoint(checkpointId);
  }

  public async recover(checkpointId?: string): Promise<AgentRuntimeRecoveryState> {
    return this.coordinator.recovery.recover(checkpointId);
  }

  // ---------------------------------------------------------------------------
  // Internal Helpers
  // ---------------------------------------------------------------------------

  private assertOperational(operation: string): void {
    const state = this.coordinator.lifecycle.getState();
    if (state !== 'READY' && state !== 'RUNNING' && state !== 'DEGRADED') {
      throw new RuntimeNotReadyError(state, operation);
    }
  }
}
