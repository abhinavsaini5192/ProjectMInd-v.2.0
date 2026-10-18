import type { IAgentLifecycleCoordinator } from './IAgentLifecycleCoordinator.js';
import type { IAgentSessionCoordinator } from './IAgentSessionCoordinator.js';
import type { IAgentTaskCoordinator } from './IAgentTaskCoordinator.js';
import type { IAgentContextCoordinator } from './IAgentContextCoordinator.js';
import type { IAgentToolCoordinator } from './IAgentToolCoordinator.js';
import type { IAgentObservationCoordinator } from './IAgentObservationCoordinator.js';
import type { IAgentVerificationCoordinator } from './IAgentVerificationCoordinator.js';
import type { IAgentRecoveryManager } from './IAgentRecoveryManager.js';
import type { IAgentCheckpointManager } from './IAgentCheckpointManager.js';
import type { IAgentRuntimeHealthManager } from './IAgentRuntimeHealthManager.js';
import type { IAgentRuntimeTelemetry } from './IAgentRuntimeTelemetry.js';
import type { AgentRuntimeConfig } from '../models/AgentRuntimeConfig.js';
import type { AgentRuntimeStatus } from '../models/AgentRuntimeStatus.js';

export interface IAgentRuntimeCoordinator {
  readonly config: AgentRuntimeConfig;
  readonly lifecycle: IAgentLifecycleCoordinator;
  readonly sessions: IAgentSessionCoordinator;
  readonly tasks: IAgentTaskCoordinator;
  readonly context: IAgentContextCoordinator;
  readonly tools: IAgentToolCoordinator;
  readonly observation: IAgentObservationCoordinator;
  readonly verification: IAgentVerificationCoordinator;
  readonly recovery: IAgentRecoveryManager;
  readonly checkpoints: IAgentCheckpointManager;
  readonly health: IAgentRuntimeHealthManager;
  readonly telemetry: IAgentRuntimeTelemetry;

  getStatus(): Promise<AgentRuntimeStatus>;
}
