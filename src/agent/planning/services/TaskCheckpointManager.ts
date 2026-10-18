import type { ITaskCheckpointManager } from '../interfaces/ITaskCheckpointManager.js';
import type { ITaskPlanStore } from '../interfaces/ITaskPlanStore.js';
import type { CanonicalTaskPlan } from '../models/CanonicalTaskPlan.js';
import type { TaskPlanCheckpoint } from '../models/TaskPlanCheckpoint.js';
import { PlanNotFoundError, PlanningError } from '../errors/PlanningError.js';

export class TaskCheckpointManager implements ITaskCheckpointManager {
  constructor(private readonly store: ITaskPlanStore) {}

  public async createCheckpoint(planId: string, description?: string): Promise<TaskPlanCheckpoint> {
    const plan = await this.store.getPlan(planId);
    if (!plan) {
      throw new PlanNotFoundError(planId);
    }

    const now = Date.now();
    const activeNodeIds = plan.nodes.filter((n) => n.status === 'IN_PROGRESS' || n.status === 'READY').map((n) => n.id);
    const completedNodeIds = plan.nodes.filter((n) => n.status === 'COMPLETED').map((n) => n.id);
    const failedNodeIds = plan.nodes.filter((n) => n.status === 'FAILED').map((n) => n.id);
    const checkpointId = `cp_${planId}_${plan.planRevision}_${now}`;

    const checkpoint: TaskPlanCheckpoint = {
      checkpointId,
      id: checkpointId,
      planId,
      planVersion: plan.version,
      planRevision: plan.planRevision,
      status: plan.status,
      nodesSnapshot: structuredClone(plan.nodes),
      snapshot: { nodes: structuredClone(plan.nodes) },
      activeNodeIds,
      completedNodeIds,
      failedNodeIds,
      createdAt: now,
      description,
      reason: description,
    };

    await this.store.saveCheckpoint(checkpoint);
    return checkpoint;
  }

  public async restoreCheckpoint(
    checkpointIdOrPlanId: string,
    maybeCheckpointId?: string
  ): Promise<CanonicalTaskPlan> {
    const targetCheckpointId = maybeCheckpointId ?? checkpointIdOrPlanId;
    const checkpoint = await this.store.getCheckpoint(targetCheckpointId);
    if (!checkpoint) {
      throw new PlanningError(`Checkpoint '${targetCheckpointId}' not found.`, 'CHECKPOINT_NOT_FOUND', {
        checkpointId: targetCheckpointId,
      });
    }

    const currentPlan = await this.store.getPlan(checkpoint.planId);
    if (!currentPlan) {
      throw new PlanNotFoundError(checkpoint.planId);
    }

    const restoredPlan: CanonicalTaskPlan = {
      ...currentPlan,
      status: checkpoint.status,
      nodes: structuredClone(checkpoint.nodesSnapshot),
      activeNodeIds: [...checkpoint.activeNodeIds],
      completedNodeIds: [...checkpoint.completedNodeIds],
      failedNodeIds: [...checkpoint.failedNodeIds],
      updatedAt: Date.now(),
      version: currentPlan.version + 1,
    };

    await this.store.savePlan(restoredPlan);
    return restoredPlan;
  }

  public async listCheckpoints(planId: string): Promise<TaskPlanCheckpoint[]> {
    return this.store.listCheckpoints(planId);
  }
}
