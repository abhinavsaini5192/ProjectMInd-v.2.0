import type { AgentTask } from '../../context/models/AgentTask.js';
import type { ITaskStore } from '../interfaces/ITaskStore.js';
import type { ITaskManager } from '../interfaces/ITaskManager.js';
import type { ITaskLifecycleManager } from '../interfaces/ITaskLifecycleManager.js';
import type { IAgentContextSessionManager } from '../../context/interfaces/IAgentContextSessionManager.js';
import type {
  ITaskRecoveryManager,
  TaskRecoveryResult,
  SessionReconnectResult,
} from '../interfaces/ITaskRecoveryManager.js';
import type { TaskRuntimeSnapshot } from '../models/TaskRuntimeSnapshot.js';
import type { TaskBlockReason } from '../models/TaskBlockReason.js';
import { TaskNotFoundError } from '../errors/TaskRuntimeError.js';

export interface TaskRecoveryManagerDependencies {
  readonly store: ITaskStore;
  readonly taskManager: ITaskManager;
  readonly lifecycleManager: ITaskLifecycleManager;
  readonly contextSessionManager?: IAgentContextSessionManager | undefined;
}

export class TaskRecoveryManager implements ITaskRecoveryManager {
  constructor(private readonly deps: TaskRecoveryManagerDependencies) {}

  public async recoverTask(taskId: string, agentSessionId: string): Promise<TaskRecoveryResult> {
    const task = await this.deps.taskManager.getTask(taskId);
    if (!task) {
      throw new TaskNotFoundError(taskId);
    }

    const warnings: string[] = [];
    let recovered = false;
    let contextStale = false;

    // 1. Check Lease & Re-acquire
    try {
      await this.deps.taskManager.acquireLease(taskId, agentSessionId);
    } catch (err: unknown) {
      warnings.push(`Could not acquire task lease: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 2. State recovery
    let currentTask = task;
    if (task.status === 'BLOCKED') {
      currentTask = await this.deps.lifecycleManager.resume(taskId, agentSessionId);
      recovered = true;
    } else if (task.status === 'IN_PROGRESS' || task.status === 'VERIFYING') {
      recovered = true;
    }

    // 3. Context session freshness verification
    if (this.deps.contextSessionManager && currentTask.contextSessionId) {
      try {
        const ctxSession = await this.deps.contextSessionManager.getContextSession(currentTask.contextSessionId);
        if (ctxSession) {
          if (ctxSession.status === 'STALE') {
            contextStale = true;
            warnings.push('Task context session is STALE. A context refresh is recommended.');
          }
        }
      } catch {
        warnings.push('Associated context session could not be queried.');
      }
    }

    const snapshot = await this.buildSnapshot(currentTask);

    return {
      task: currentTask,
      snapshot,
      recovered,
      contextStale,
      warnings,
    };
  }

  public async reconnectSession(agentSessionId: string): Promise<SessionReconnectResult> {
    const allTasks = await this.deps.taskManager.listTasks({ agentSessionId });
    const activeTasks = allTasks.filter(
      (t) =>
        t.status === 'CREATED' ||
        t.status === 'ANALYZING' ||
        t.status === 'READY' ||
        t.status === 'IN_PROGRESS' ||
        t.status === 'BLOCKED' ||
        t.status === 'VERIFYING'
    );

    const snapshots: TaskRuntimeSnapshot[] = [];
    for (const task of activeTasks) {
      snapshots.push(await this.buildSnapshot(task));
    }

    return {
      agentSessionId,
      activeTasks,
      snapshots,
    };
  }

  public async buildSnapshot(task: AgentTask): Promise<TaskRuntimeSnapshot> {
    const execState = (await this.deps.store.getExecutionState(task.taskId)) ?? {
      executionState: 'NOT_STARTED',
      updatedAt: task.createdAt,
      operationHistory: [],
    };

    const verifState = (await this.deps.store.getVerificationState(task.taskId)) ?? {
      verificationState: 'NOT_STARTED',
      verificationSource: 'UNKNOWN',
      diagnostics: [],
      updatedAt: task.createdAt,
      operationHistory: [],
    };

    const lease = await this.deps.store.getLease(task.taskId);

    return {
      task,
      agentSessionId: task.agentSessionId,
      contextSessionId: task.contextSessionId,
      executionState: execState,
      verificationState: verifState,
      currentContextVersion: task.lastContextVersion ?? 1,
      knowledgeVersion: task.lastKnowledgeVersion,
      blockingState:
        task.status === 'BLOCKED'
          ? {
              isBlocked: true,
              reason: task.blockedReason as TaskBlockReason | undefined,
              details: task.blockedReason,
            }
          : undefined,
      taskVersion: task.taskVersion ?? 1,
      lease:
        lease && lease.expiresAt.getTime() > Date.now()
          ? {
              owner: lease.leaseOwner,
              expiresAt: lease.expiresAt,
            }
          : undefined,
      timestamps: {
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        startedAt: task.startedAt,
        completedAt: task.completedAt,
      },
    };
  }
}
