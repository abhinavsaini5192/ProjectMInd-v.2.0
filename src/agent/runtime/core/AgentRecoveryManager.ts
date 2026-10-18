import type { AgentRuntimeRecoveryState } from '../models/AgentRuntimeRecoveryState.js';
import type { IAgentRecoveryManager } from '../interfaces/IAgentRecoveryManager.js';
import type { IAgentCheckpointManager } from '../interfaces/IAgentCheckpointManager.js';
import type { IAgentLifecycleCoordinator } from '../interfaces/IAgentLifecycleCoordinator.js';
import { RuntimeRecoveryPlanner } from '../recovery/RuntimeRecoveryPlanner.js';
import { SessionRecoveryManager } from '../recovery/SessionRecoveryManager.js';
import { ContextRecoveryManager } from '../recovery/ContextRecoveryManager.js';
import type { IAgentContextSessionManager } from '../../context/interfaces/IAgentContextSessionManager.js';
import type { IEventBus } from '../../../workspace/interfaces/IEventBus.js';
import { AgentRuntimeEvents } from '../events/AgentRuntimeEvents.js';

export class AgentRecoveryManager implements IAgentRecoveryManager {
  private readonly planner: RuntimeRecoveryPlanner;
  private readonly sessionRecovery: SessionRecoveryManager;
  private readonly contextRecovery: ContextRecoveryManager;
  private lastRecoveryState?: AgentRuntimeRecoveryState | undefined;

  constructor(
    private readonly checkpointManager: IAgentCheckpointManager,
    private readonly lifecycle: IAgentLifecycleCoordinator,
    contextSessionManager?: IAgentContextSessionManager | undefined,
    private readonly eventBus?: IEventBus | undefined,
    sessionTtlMs: number = 3600000
  ) {
    this.planner = new RuntimeRecoveryPlanner();
    this.sessionRecovery = new SessionRecoveryManager(sessionTtlMs);
    this.contextRecovery = new ContextRecoveryManager(contextSessionManager);
  }

  public getRecoveryState(): AgentRuntimeRecoveryState | undefined {
    return this.lastRecoveryState;
  }

  public async recover(checkpointId?: string): Promise<AgentRuntimeRecoveryState> {
    const warnings: string[] = [];
    let recoveredSessionsCount = 0;
    let recoveredTasksCount = 0;

    try {
      // 1. Mark state recovering
      await this.lifecycle.setDegraded('Initiating recovery procedure');

      // 2. Locate checkpoint if specified or use latest
      let checkpoint = checkpointId ? await this.checkpointManager.getCheckpoint(checkpointId) : undefined;
      if (!checkpoint && !checkpointId) {
        const list = await this.checkpointManager.listCheckpoints();
        checkpoint = list[0];
      }

      // 3. Create plan
      const plan = this.planner.createPlan(checkpoint);

      // 4. Reconcile sessions
      if (checkpoint) {
        const sessionResult = this.sessionRecovery.reconcileSessions(checkpoint.activeSessionIds, new Set());
        recoveredSessionsCount = sessionResult.restoredSessionIds.length;
        warnings.push(...sessionResult.warnings);

        // 5. Invalidate context sessions
        if (checkpoint.contextVersion) {
          const contextResult = await this.contextRecovery.invalidateSessionsForRecovery([checkpoint.contextVersion]);
          warnings.push(...contextResult.warnings);
        }

        recoveredTasksCount = checkpoint.activeTaskIds.length;
      }

      // 6. Complete recovery on lifecycle
      await this.lifecycle.recover();

      const completedAt = Date.now();
      this.lastRecoveryState = {
        status: 'RECOVERED',
        checkpointId: checkpoint?.checkpointId,
        recoveredSessionsCount,
        recoveredTasksCount,
        contextRefreshed: true,
        knowledgeVersionAligned: true,
        details: `Recovery successfully completed. Plan steps executed: ${plan.steps.length}`,
        completedAt,
      };

      if (this.eventBus) {
        this.eventBus.publish(AgentRuntimeEvents.RUNTIME_RECOVERED, {
          checkpointId: checkpoint?.checkpointId,
          recoveredSessionsCount,
          recoveredTasksCount,
          timestamp: new Date().toISOString(),
        });
      }

      return this.lastRecoveryState;
    } catch (err: unknown) {
      const completedAt = Date.now();
      const message = err instanceof Error ? err.message : String(err);

      this.lastRecoveryState = {
        status: 'FAILED',
        checkpointId,
        recoveredSessionsCount,
        recoveredTasksCount,
        contextRefreshed: false,
        knowledgeVersionAligned: false,
        error: message,
        details: 'Recovery failed during execution',
        completedAt,
      };

      if (this.eventBus) {
        this.eventBus.publish(AgentRuntimeEvents.RUNTIME_FAILED, {
          error: message,
          timestamp: new Date().toISOString(),
        });
      }

      return this.lastRecoveryState;
    }
  }

  public async reconcileState(): Promise<AgentRuntimeRecoveryState> {
    return this.recover();
  }
}
