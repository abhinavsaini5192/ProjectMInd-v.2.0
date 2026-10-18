import type { IAgentRuntimeCoordinator } from '../interfaces/IAgentRuntimeCoordinator.js';
import type { IAgentLifecycleCoordinator } from '../interfaces/IAgentLifecycleCoordinator.js';
import type { IAgentSessionCoordinator } from '../interfaces/IAgentSessionCoordinator.js';
import type { IAgentTaskCoordinator } from '../interfaces/IAgentTaskCoordinator.js';
import type { IAgentContextCoordinator } from '../interfaces/IAgentContextCoordinator.js';
import type { IAgentToolCoordinator } from '../interfaces/IAgentToolCoordinator.js';
import type { IAgentObservationCoordinator } from '../interfaces/IAgentObservationCoordinator.js';
import type { IAgentVerificationCoordinator } from '../interfaces/IAgentVerificationCoordinator.js';
import type { IAgentRecoveryManager } from '../interfaces/IAgentRecoveryManager.js';
import type { IAgentCheckpointManager } from '../interfaces/IAgentCheckpointManager.js';
import type { IAgentRuntimeHealthManager } from '../interfaces/IAgentRuntimeHealthManager.js';
import type { IAgentRuntimeTelemetry } from '../interfaces/IAgentRuntimeTelemetry.js';
import type { AgentRuntimeConfig } from '../models/AgentRuntimeConfig.js';
import type { AgentRuntimeStatus } from '../models/AgentRuntimeStatus.js';

export class AgentRuntimeCoordinator implements IAgentRuntimeCoordinator {
  private readonly startedAt: number = Date.now();

  constructor(
    public readonly config: AgentRuntimeConfig,
    public readonly lifecycle: IAgentLifecycleCoordinator,
    public readonly sessions: IAgentSessionCoordinator,
    public readonly tasks: IAgentTaskCoordinator,
    public readonly context: IAgentContextCoordinator,
    public readonly tools: IAgentToolCoordinator,
    public readonly observation: IAgentObservationCoordinator,
    public readonly verification: IAgentVerificationCoordinator,
    public readonly recovery: IAgentRecoveryManager,
    public readonly checkpoints: IAgentCheckpointManager,
    public readonly health: IAgentRuntimeHealthManager,
    public readonly telemetry: IAgentRuntimeTelemetry
  ) {}

  public async getStatus(): Promise<AgentRuntimeStatus> {
    const health = await this.health.getHealth();
    const degradedSubsystems = Object.entries(health.subsystems)
      .filter(([, s]) => s.status === 'DEGRADED' || s.status === 'UNHEALTHY')
      .map(([name]) => name);

    return {
      runtimeId: this.config.runtimeId,
      workspaceId: this.config.workspaceId,
      repositoryId: this.config.repositoryId,
      adapterId: this.config.defaultAdapterId,
      state: this.lifecycle.getState(),
      runtimeVersion: '1.0.0',
      activeSessionsCount: this.sessions.getActiveSessionCount(),
      activeTasksCount: this.tasks.getActiveTaskCount(),
      currentKnowledgeVersion: '1.0.0',
      currentContextVersion: '1',
      degradedSubsystems,
      uptimeMs: Date.now() - this.startedAt,
      startedAt: this.startedAt,
    };
  }
}
