import type { DIContainer } from '../../../workspace/di/DIContainer.js';
import type { IEventBus } from '../../../workspace/interfaces/IEventBus.js';
import type { IAgentSessionManager } from '../../interfaces/IAgentSessionManager.js';
import type { ITaskRuntime } from '../interfaces/ITaskRuntime.js';
import type { IAgentContextSessionManager } from '../../context/interfaces/IAgentContextSessionManager.js';
import type { IAgentToolPipeline } from '../../protocol/interfaces/IAgentToolPipeline.js';
import type { IObservationProcessor } from '../../observation/interfaces/IObservationProcessor.js';
import type { IVerificationProcessor } from '../../../verification/interfaces/IVerificationProcessor.js';
import type { ITaskExecutionCoordinator } from '../interfaces/ITaskExecutionCoordinator.js';
import type { ITaskVerificationCoordinator } from '../interfaces/ITaskVerificationCoordinator.js';

import { AgentRuntimeTokens } from './AgentRuntimeTokens.js';
import { createDefaultRuntimeConfig, type AgentRuntimeConfig } from '../models/AgentRuntimeConfig.js';
import { RuntimeLifecycleManager } from '../lifecycle/RuntimeLifecycleManager.js';
import { AgentRuntimeHealthManager } from '../core/AgentRuntimeHealthManager.js';
import { AgentRuntimeTelemetry } from '../core/AgentRuntimeTelemetry.js';
import { AgentCheckpointManager, type CheckpointDataProvider } from '../core/AgentCheckpointManager.js';
import { AgentRecoveryManager } from '../core/AgentRecoveryManager.js';
import { AgentSessionCoordinator } from '../core/AgentSessionCoordinator.js';
import { AgentTaskCoordinator } from '../core/AgentTaskCoordinator.js';
import { AgentContextCoordinator } from '../core/AgentContextCoordinator.js';
import { AgentToolCoordinator } from '../core/AgentToolCoordinator.js';
import { AgentObservationCoordinator } from '../core/AgentObservationCoordinator.js';
import { AgentVerificationCoordinator } from '../core/AgentVerificationCoordinator.js';
import { AgentRuntimeCoordinator } from '../core/AgentRuntimeCoordinator.js';
import { ProductionAgentRuntime } from '../core/ProductionAgentRuntime.js';

export interface ProductionAgentRuntimeSetupDependencies {
  readonly sessionManager: IAgentSessionManager;
  readonly taskRuntime: ITaskRuntime;
  readonly contextSessionManager: IAgentContextSessionManager;
  readonly toolPipeline: IAgentToolPipeline;
  readonly executionCoordinator: ITaskExecutionCoordinator;
  readonly verificationCoordinator: ITaskVerificationCoordinator;
  readonly observationProcessor?: IObservationProcessor | undefined;
  readonly verificationProcessor?: IVerificationProcessor | undefined;
  readonly eventBus?: IEventBus | undefined;
  readonly config?: Partial<AgentRuntimeConfig> | undefined;
}

export function createProductionAgentRuntime(
  deps: ProductionAgentRuntimeSetupDependencies
): ProductionAgentRuntime {
  const config = createDefaultRuntimeConfig(
    deps.config?.runtimeId ?? 'runtime_production',
    deps.config?.workspaceId ?? 'workspace_default',
    deps.config?.repositoryId ?? 'repo_default',
    deps.config
  );

  const lifecycle = new RuntimeLifecycleManager(deps.eventBus);
  const health = new AgentRuntimeHealthManager(config.runtimeId);
  const telemetry = new AgentRuntimeTelemetry();

  const sessions = new AgentSessionCoordinator(
    deps.sessionManager,
    config.limits.maxConcurrentSessions,
    telemetry
  );

  const tasks = new AgentTaskCoordinator(
    deps.taskRuntime,
    config.limits.maxConcurrentTasks,
    telemetry
  );

  const context = new AgentContextCoordinator(
    deps.contextSessionManager,
    config.contextRefreshPolicy,
    telemetry
  );

  const tools = new AgentToolCoordinator(
    deps.toolPipeline,
    config.limits.toolTimeoutMs,
    config.limits.maxRequestSizeBytes,
    telemetry
  );

  const observation = new AgentObservationCoordinator(
    deps.executionCoordinator,
    deps.observationProcessor,
    deps.eventBus
  );

  const verification = new AgentVerificationCoordinator(
    deps.verificationCoordinator,
    deps.verificationProcessor
  );

  const dataProvider: CheckpointDataProvider = {
    getRuntimeId: () => config.runtimeId,
    getWorkspaceId: () => config.workspaceId,
    getRepositoryId: () => config.repositoryId,
    getState: () => lifecycle.getState(),
    getActiveSessionIds: async () => {
      const active = await sessions.listActiveSessions();
      return active.map((s) => s.sessionId);
    },
    getActiveTaskIds: async () => [],
    getKnowledgeVersion: () => '1.0.0',
    getContextVersion: () => '1',
  };

  const checkpoints = new AgentCheckpointManager(dataProvider, deps.eventBus);

  const recovery = new AgentRecoveryManager(
    checkpoints,
    lifecycle,
    deps.contextSessionManager,
    deps.eventBus
  );

  const coordinator = new AgentRuntimeCoordinator(
    config,
    lifecycle,
    sessions,
    tasks,
    context,
    tools,
    observation,
    verification,
    recovery,
    checkpoints,
    health,
    telemetry
  );

  return new ProductionAgentRuntime(coordinator);
}

export function registerProductionAgentRuntime(
  container: DIContainer,
  runtime: ProductionAgentRuntime
): void {
  container.registerFactory(AgentRuntimeTokens.IProductionAgentRuntime, () => runtime, 'Singleton');
}
