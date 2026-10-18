import type {
  ITaskPlanRevisionManager,
  CreateRevisionParams,
} from '../interfaces/ITaskPlanRevisionManager.js';
import type { ITaskPlanStore } from '../interfaces/ITaskPlanStore.js';
import type { CanonicalTaskPlan } from '../models/CanonicalTaskPlan.js';
import type { TaskPlanRevision, RevisionTrigger } from '../models/TaskPlanRevision.js';
import type { TaskPlanNode } from '../models/TaskPlanNode.js';
import { PlanNotFoundError } from '../errors/PlanningError.js';

export class TaskPlanRevisionManager implements ITaskPlanRevisionManager {
  constructor(private readonly store: ITaskPlanStore) {}

  public async createRevision(
    paramsOrPlanId: CreateRevisionParams | string,
    options?: {
      readonly trigger: RevisionTrigger;
      readonly reason: string;
      readonly author?: string;
      readonly modifiedNodes?: readonly string[];
      readonly modifications?: CreateRevisionParams['modifications'];
    }
  ): Promise<any> {
    const planId = typeof paramsOrPlanId === 'string' ? paramsOrPlanId : paramsOrPlanId.planId;
    const trigger = typeof paramsOrPlanId === 'string' ? options?.trigger ?? 'MANUAL_REQUEST' : paramsOrPlanId.trigger;
    const reason = typeof paramsOrPlanId === 'string' ? options?.reason ?? '' : paramsOrPlanId.reason;
    const createdBy =
      typeof paramsOrPlanId === 'string'
        ? options?.author ?? 'SYSTEM'
        : paramsOrPlanId.createdBy;
    const modifications =
      typeof paramsOrPlanId === 'string'
        ? options?.modifications ?? {}
        : paramsOrPlanId.modifications ?? {};

    const plan = await this.store.getPlan(planId);
    if (!plan) {
      throw new PlanNotFoundError(planId);
    }

    const previousRevision = plan.planRevision;
    const newRevision = previousRevision + 1;
    const now = Date.now();

    const affectedNodeIds: string[] = options?.modifiedNodes ? [...options.modifiedNodes] : [];
    const addedNodeIds: string[] = [];
    const removedNodeIds = modifications.removeNodeIds ? [...modifications.removeNodeIds] : [];

    let currentNodes = [...plan.nodes];

    // 1. Remove nodes
    if (modifications.removeNodeIds && modifications.removeNodeIds.length > 0) {
      const toRemove = new Set(modifications.removeNodeIds);
      currentNodes = currentNodes.filter((n) => !toRemove.has(n.id));
      affectedNodeIds.push(...modifications.removeNodeIds);
    }

    // 2. Update nodes
    if (modifications.updateNodes && modifications.updateNodes.length > 0) {
      for (const updatedNode of modifications.updateNodes) {
        const idx = currentNodes.findIndex((n) => n.id === updatedNode.id);
        if (idx >= 0) {
          currentNodes[idx] = updatedNode;
          affectedNodeIds.push(updatedNode.id);
        }
      }
    }

    // 3. Add nodes
    if (modifications.addNodes && modifications.addNodes.length > 0) {
      for (const newNode of modifications.addNodes) {
        currentNodes.push(newNode);
        addedNodeIds.push(newNode.id);
        affectedNodeIds.push(newNode.id);
      }
    }

    const revisedPlan: CanonicalTaskPlan = {
      ...plan,
      nodes: currentNodes,
      planRevision: newRevision,
      version: plan.version + 1,
      updatedAt: now,
    };

    const revision: TaskPlanRevision = {
      revisionId: `rev_${planId}_${newRevision}_${now}`,
      planId,
      previousRevision,
      newRevision,
      revisionNumber: newRevision,
      trigger,
      reason,
      affectedNodeIds,
      addedNodeIds,
      removedNodeIds,
      createdAt: now,
      createdBy,
    };

    await this.store.savePlan(revisedPlan);
    await this.store.saveRevision(revision);

    // If called with (planId, options), return the revision itself to match test expectation,
    // while attaching revisedPlan
    return Object.assign(revision, { revisedPlan, revision });
  }

  public async replan(
    planId: string,
    newNodes: readonly TaskPlanNode[],
    reason: string,
    createdBy: string = 'SYSTEM'
  ): Promise<CanonicalTaskPlan> {
    const plan = await this.store.getPlan(planId);
    if (!plan) {
      throw new PlanNotFoundError(planId);
    }

    const previousRevision = plan.planRevision;
    const newRevision = previousRevision + 1;
    const now = Date.now();

    const revisedPlan: CanonicalTaskPlan = {
      ...plan,
      nodes: [...newNodes],
      planRevision: newRevision,
      version: plan.version + 1,
      updatedAt: now,
    };

    const revision: TaskPlanRevision = {
      revisionId: `rev_${planId}_${newRevision}_${now}`,
      planId,
      previousRevision,
      newRevision,
      revisionNumber: newRevision,
      trigger: 'MANUAL_REQUEST',
      reason,
      affectedNodeIds: newNodes.map((n) => n.id),
      addedNodeIds: [],
      removedNodeIds: [],
      createdAt: now,
      createdBy,
    };

    await this.store.savePlan(revisedPlan);
    await this.store.saveRevision(revision);

    return revisedPlan;
  }

  public async listRevisions(planId: string): Promise<readonly TaskPlanRevision[]> {
    return this.store.listRevisions(planId);
  }

  public async replanAfterFailure(
    planId: string,
    failedNodeId: string,
    errorReason: string,
    createdBy: string
  ): Promise<CanonicalTaskPlan> {
    const plan = await this.store.getPlan(planId);
    if (!plan) {
      throw new PlanNotFoundError(planId);
    }

    const failedNode = plan.nodes.find((n) => n.id === failedNodeId);
    if (!failedNode) {
      return plan;
    }

    const now = Date.now();
    const remediationNode: TaskPlanNode = {
      id: `remedy_${failedNodeId}_${now}`,
      planId,
      taskId: `task_remedy_${failedNodeId}_${now}`,
      title: `Remediate Failure in '${failedNode.title}'`,
      objective: `Investigate and fix failure: ${errorReason}`,
      description: `Auto-generated replan remediation step for failed node '${failedNodeId}'.`,
      taskType: 'INVESTIGATION',
      status: 'PENDING',
      priority: Math.min(10, (failedNode.priority ?? 5) + 1),
      dependencies: failedNode.dependencies,
      requiredCapabilities: failedNode.requiredCapabilities,
      preferredAgentRole: 'RESEARCHER',
      affectedFeatures: failedNode.affectedFeatures,
      affectedResources: failedNode.affectedResources,
      risk: 'MEDIUM',
      constraints: [],
      approval: { status: 'NOT_REQUIRED' },
      createdAt: now,
      updatedAt: now,
      retryCount: 0,
      maxRetries: 3,
    };

    const updatedFailedNode: TaskPlanNode = {
      ...failedNode,
      status: 'PENDING',
      dependencies: [{ targetNodeId: remediationNode.id, type: 'FOLLOWS' }],
      retryCount: (failedNode.retryCount ?? 0) + 1,
      failureReason: undefined,
      updatedAt: now,
    };

    const result = await this.createRevision({
      planId,
      trigger: 'TASK_FAILURE',
      reason: `Replanned after node '${failedNodeId}' failed: ${errorReason}`,
      createdBy,
      modifications: {
        addNodes: [remediationNode],
        updateNodes: [updatedFailedNode],
      },
    });

    return result.revisedPlan;
  }
}
