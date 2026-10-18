import type {
  ITaskPlanStore,
  TaskPlanQuery,
} from '../interfaces/ITaskPlanStore.js';
import type { CanonicalTaskPlan } from '../models/CanonicalTaskPlan.js';
import type { TaskPlanNode } from '../models/TaskPlanNode.js';
import type { TaskPlanCheckpoint } from '../models/TaskPlanCheckpoint.js';
import type { TaskPlanRevision } from '../models/TaskPlanRevision.js';
import type { TaskArtifact } from '../models/TaskArtifact.js';

export class InMemoryTaskPlanStore implements ITaskPlanStore {
  private readonly plans = new Map<string, CanonicalTaskPlan>();
  private readonly checkpoints = new Map<string, TaskPlanCheckpoint>();
  private readonly revisions = new Map<string, TaskPlanRevision[]>();
  private readonly artifacts = new Map<string, TaskArtifact[]>();

  public async savePlan(plan: CanonicalTaskPlan): Promise<void> {
    this.plans.set(plan.id, structuredClone(plan));
  }

  public async getPlan(planId: string): Promise<CanonicalTaskPlan | null> {
    const plan = this.plans.get(planId);
    return plan ? structuredClone(plan) : null;
  }

  public async listPlans(query?: TaskPlanQuery): Promise<CanonicalTaskPlan[]> {
    let result = Array.from(this.plans.values());

    if (query?.workspaceId) {
      result = result.filter((p) => p.workspaceId === query.workspaceId);
    }
    if (query?.projectId) {
      result = result.filter((p) => p.projectId === query.projectId);
    }
    if (query?.status) {
      result = result.filter((p) => p.status === query.status);
    }

    result.sort((a, b) => b.updatedAt - a.updatedAt);

    if (query?.limit && query.limit > 0) {
      result = result.slice(0, query.limit);
    }

    return result.map((p) => structuredClone(p));
  }

  public async deletePlan(planId: string): Promise<boolean> {
    const existed = this.plans.delete(planId);
    this.revisions.delete(planId);
    this.artifacts.delete(planId);
    return existed;
  }

  public async updateNode(planId: string, node: TaskPlanNode): Promise<void> {
    const plan = this.plans.get(planId);
    if (!plan) return;

    const idx = plan.nodes.findIndex((n) => n.id === node.id);
    const updatedNodes = [...plan.nodes];
    if (idx >= 0) {
      updatedNodes[idx] = structuredClone(node);
    } else {
      updatedNodes.push(structuredClone(node));
    }

    const updatedPlan: CanonicalTaskPlan = {
      ...plan,
      nodes: updatedNodes,
      updatedAt: Date.now(),
      version: plan.version + 1,
    };
    this.plans.set(planId, updatedPlan);
  }

  public async getNode(planId: string, nodeId: string): Promise<TaskPlanNode | null> {
    const plan = this.plans.get(planId);
    if (!plan) return null;
    const node = plan.nodes.find((n) => n.id === nodeId);
    return node ? structuredClone(node) : null;
  }

  public async saveCheckpoint(checkpoint: TaskPlanCheckpoint): Promise<void> {
    this.checkpoints.set(checkpoint.checkpointId, structuredClone(checkpoint));
  }

  public async getCheckpoint(checkpointId: string): Promise<TaskPlanCheckpoint | null> {
    const cp = this.checkpoints.get(checkpointId);
    return cp ? structuredClone(cp) : null;
  }

  public async listCheckpoints(planId: string): Promise<TaskPlanCheckpoint[]> {
    return Array.from(this.checkpoints.values())
      .filter((cp) => cp.planId === planId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((cp) => structuredClone(cp));
  }

  public async saveRevision(revision: TaskPlanRevision): Promise<void> {
    const existing = this.revisions.get(revision.planId) ?? [];
    existing.push(structuredClone(revision));
    this.revisions.set(revision.planId, existing);
  }

  public async listRevisions(planId: string): Promise<TaskPlanRevision[]> {
    const existing = this.revisions.get(planId) ?? [];
    return existing.sort((a, b) => b.createdAt - a.createdAt).map((r) => structuredClone(r));
  }

  public async getRevisions(planId: string): Promise<TaskPlanRevision[]> {
    return this.listRevisions(planId);
  }

  public async saveArtifact(artifact: TaskArtifact): Promise<void> {
    const existing = this.artifacts.get(artifact.planId) ?? [];
    existing.push(structuredClone(artifact));
    this.artifacts.set(artifact.planId, existing);
  }

  public async listArtifacts(planId: string, nodeId?: string): Promise<TaskArtifact[]> {
    let existing = this.artifacts.get(planId) ?? [];
    if (nodeId) {
      existing = existing.filter((a) => a.nodeId === nodeId);
    }
    return existing.sort((a, b) => b.timestamp - a.timestamp).map((a) => structuredClone(a));
  }
}
