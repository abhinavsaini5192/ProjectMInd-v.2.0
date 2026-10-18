import crypto from 'node:crypto';
import type { IConflictDetector } from '../interfaces/IConflictDetector.js';
import type { ICollaborationStore } from '../interfaces/ICollaborationStore.js';
import type { CollaborationConflict } from '../models/index.js';

export class ConflictDetector implements IConflictDetector {
  constructor(private readonly store: ICollaborationStore) {}

  public async detectConflicts(collaborationSessionId: string): Promise<CollaborationConflict[]> {
    const session = await this.store.getSession(collaborationSessionId);
    if (!session) return [];

    const conflicts: CollaborationConflict[] = [];
    const reservations = await this.store.listReservations({
      collaborationSessionId,
      activeOnly: true,
    });

    // 1. Detect duplicate resource claims among different agents
    const resourceMap = new Map<string, string[]>();
    for (const res of reservations) {
      const owners = resourceMap.get(res.resourceId) ?? [];
      if (!owners.includes(res.ownerAgentId)) {
        owners.push(res.ownerAgentId);
      }
      resourceMap.set(res.resourceId, owners);
    }

    for (const [resourceId, owners] of resourceMap.entries()) {
      if (owners.length > 1) {
        const conflictId = `conf_res_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
        const conflict: CollaborationConflict = {
          conflictId,
          collaborationSessionId,
          scope: {
            workspaceId: session.workspaceId,
            projectId: session.projectId,
          },
          resources: [resourceId],
          participants: owners,
          type: 'RESOURCE_CONFLICT',
          severity: 'HIGH',
          description: `Resource '${resourceId}' is claimed concurrently by multiple agents: ${owners.join(', ')}`,
          detectedAt: Date.now(),
          status: 'OPEN',
        };
        conflicts.push(conflict);
        await this.store.saveConflict(conflict);
      }
    }

    // 2. Detect task ownership anomalies
    const taskOwnerships = await this.store.listTaskOwnerships(collaborationSessionId);
    const taskMap = new Map<string, string[]>();
    for (const to of taskOwnerships) {
      if (to.status === 'ASSIGNED' || to.status === 'IN_PROGRESS') {
        const owners = taskMap.get(to.taskId) ?? [];
        owners.push(to.ownerAgentId);
        taskMap.set(to.taskId, owners);
      }
    }

    for (const [taskId, owners] of taskMap.entries()) {
      if (owners.length > 1) {
        const conflictId = `conf_task_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
        const conflict: CollaborationConflict = {
          conflictId,
          collaborationSessionId,
          scope: {
            workspaceId: session.workspaceId,
            projectId: session.projectId,
          },
          resources: [taskId],
          participants: owners,
          type: 'OWNERSHIP_CONFLICT',
          severity: 'HIGH',
          description: `Task '${taskId}' has conflicting simultaneous active owners: ${owners.join(', ')}`,
          detectedAt: Date.now(),
          status: 'OPEN',
        };
        conflicts.push(conflict);
        await this.store.saveConflict(conflict);
      }
    }

    return conflicts;
  }

  public async checkResourceConflict(
    collaborationSessionId: string,
    resourceId: string,
    requestingAgentId: string
  ): Promise<CollaborationConflict | null> {
    const session = await this.store.getSession(collaborationSessionId);
    if (!session) return null;

    const existingReservations = await this.store.listReservations({
      collaborationSessionId,
      resourceId,
      activeOnly: true,
    });

    for (const res of existingReservations) {
      if (res.ownerAgentId !== requestingAgentId && !res.isStale && res.state !== 'UNOWNED') {
        return {
          conflictId: `conf_chk_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
          collaborationSessionId,
          scope: {
            workspaceId: session.workspaceId,
            projectId: session.projectId,
          },
          resources: [resourceId],
          participants: [res.ownerAgentId, requestingAgentId],
          type: 'RESOURCE_CONFLICT',
          severity: 'HIGH',
          description: `Resource '${resourceId}' is currently reserved by agent '${res.ownerAgentId}'`,
          detectedAt: Date.now(),
          status: 'OPEN',
        };
      }
    }

    return null;
  }

  public async checkTaskConflict(
    collaborationSessionId: string,
    taskId: string,
    requestingAgentId: string
  ): Promise<CollaborationConflict | null> {
    const session = await this.store.getSession(collaborationSessionId);
    if (!session) return null;

    const existing = await this.store.getTaskOwnership(collaborationSessionId, taskId);
    if (existing && existing.ownerAgentId !== requestingAgentId && (existing.status === 'ASSIGNED' || existing.status === 'IN_PROGRESS')) {
      return {
        conflictId: `conf_chk_task_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
        collaborationSessionId,
        scope: {
          workspaceId: session.workspaceId,
          projectId: session.projectId,
        },
        resources: [taskId],
        participants: [existing.ownerAgentId, requestingAgentId],
        type: 'TASK_CONFLICT',
        severity: 'MEDIUM',
        description: `Task '${taskId}' is currently assigned to agent '${existing.ownerAgentId}'`,
        detectedAt: Date.now(),
        status: 'OPEN',
      };
    }

    return null;
  }
}
