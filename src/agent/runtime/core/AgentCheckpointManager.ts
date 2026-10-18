import type { AgentRuntimeCheckpoint } from '../models/AgentRuntimeCheckpoint.js';
import type { AgentRuntimeRecoveryState } from '../models/AgentRuntimeRecoveryState.js';
import type { AgentRuntimeState } from '../models/AgentRuntimeState.js';
import type { IAgentCheckpointManager } from '../interfaces/IAgentCheckpointManager.js';
import type { IEventBus } from '../../../workspace/interfaces/IEventBus.js';
import { AgentRuntimeEvents } from '../events/AgentRuntimeEvents.js';
import { RuntimeRecoveryError } from '../errors/AgentRuntimeError.js';

export interface CheckpointDataProvider {
  getRuntimeId(): string;
  getWorkspaceId(): string;
  getRepositoryId(): string;
  getState(): AgentRuntimeState;
  getActiveSessionIds(): Promise<readonly string[]>;
  getActiveTaskIds(): Promise<readonly string[]>;
  getKnowledgeVersion(): string;
  getContextVersion(): string;
}

export class AgentCheckpointManager implements IAgentCheckpointManager {
  private readonly checkpoints = new Map<string, AgentRuntimeCheckpoint>();
  private readonly maxCheckpoints: number;

  constructor(
    private readonly dataProvider: CheckpointDataProvider,
    private readonly eventBus?: IEventBus | undefined,
    maxCheckpoints: number = 50
  ) {
    this.maxCheckpoints = maxCheckpoints;
  }

  public async createCheckpoint(label?: string): Promise<AgentRuntimeCheckpoint> {
    const checkpointId = `chk_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const runtimeState = this.dataProvider.getState();
    const activeSessionIds = await this.dataProvider.getActiveSessionIds();
    const activeTaskIds = await this.dataProvider.getActiveTaskIds();
    const knowledgeVersion = this.dataProvider.getKnowledgeVersion();
    const contextVersion = this.dataProvider.getContextVersion();

    const checkpoint: AgentRuntimeCheckpoint = {
      checkpointId,
      runtimeId: this.dataProvider.getRuntimeId(),
      workspaceId: this.dataProvider.getWorkspaceId(),
      repositoryId: this.dataProvider.getRepositoryId(),
      runtimeState,
      activeSessionIds,
      activeTaskIds,
      knowledgeVersion,
      contextVersion,
      createdAt: Date.now(),
      metadata: label ? { label } : {},
    };

    this.checkpoints.set(checkpointId, checkpoint);
    if (this.checkpoints.size > this.maxCheckpoints) {
      const oldestKey = this.checkpoints.keys().next().value;
      if (oldestKey) {
        this.checkpoints.delete(oldestKey);
      }
    }

    if (this.eventBus) {
      this.eventBus.publish(AgentRuntimeEvents.RUNTIME_CHECKPOINT_CREATED, {
        checkpointId,
        runtimeState,
        sessionCount: activeSessionIds.length,
        taskCount: activeTaskIds.length,
        timestamp: new Date().toISOString(),
      });
    }

    return checkpoint;
  }

  public async getCheckpoint(checkpointId: string): Promise<AgentRuntimeCheckpoint | undefined> {
    return this.checkpoints.get(checkpointId);
  }

  public async listCheckpoints(): Promise<readonly AgentRuntimeCheckpoint[]> {
    return Array.from(this.checkpoints.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  public async restoreCheckpoint(checkpointId: string): Promise<AgentRuntimeRecoveryState> {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      throw new RuntimeRecoveryError(`Checkpoint '${checkpointId}' not found`, checkpointId);
    }

    return {
      status: 'RECOVERED',
      checkpointId,
      recoveredSessionsCount: checkpoint.activeSessionIds.length,
      recoveredTasksCount: checkpoint.activeTaskIds.length,
      contextRefreshed: true,
      knowledgeVersionAligned: true,
      details: `Restored from checkpoint ${checkpointId}`,
      completedAt: Date.now(),
    };
  }

  public async pruneCheckpoints(keepCount: number): Promise<number> {
    if (this.checkpoints.size <= keepCount) {
      return 0;
    }
    const sorted = Array.from(this.checkpoints.entries()).sort((a, b) => a[1].createdAt - b[1].createdAt);
    const toRemoveCount = sorted.length - keepCount;
    for (let i = 0; i < toRemoveCount; i++) {
      const entry = sorted[i];
      if (entry) {
        this.checkpoints.delete(entry[0]);
      }
    }
    return toRemoveCount;
  }
}
