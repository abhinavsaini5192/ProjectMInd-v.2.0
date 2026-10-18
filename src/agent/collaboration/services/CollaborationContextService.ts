import type { ICollaborationContextService } from '../interfaces/ICollaborationContextService.js';
import type { ICollaborationStore } from '../interfaces/ICollaborationStore.js';
import type { ContextOrchestrator } from '../../../context/orchestrator/ContextOrchestrator.js';
import type { ContextRequest } from '../../../context/models/ContextRequest.js';
import { CollaborationNotFoundError } from '../errors/CollaborationError.js';

export class CollaborationContextService implements ICollaborationContextService {
  constructor(
    private readonly store: ICollaborationStore,
    private readonly contextOrchestrator?: ContextOrchestrator | undefined
  ) {}

  public async buildSharedContext(
    collaborationSessionId: string
  ): Promise<Record<string, unknown>> {
    const session = await this.store.getSession(collaborationSessionId);
    if (!session) {
      throw new CollaborationNotFoundError(
        `Collaboration session '${collaborationSessionId}' not found.`
      );
    }

    const participants = await this.store.getParticipants(collaborationSessionId);
    const reservations = await this.store.listReservations({
      collaborationSessionId,
      activeOnly: true,
    });
    const decisions = await this.store.listDecisions(collaborationSessionId);
    const conflicts = await this.store.listConflicts({
      collaborationSessionId,
      status: ['OPEN', 'ACKNOWLEDGED'],
    });

    return {
      collaborationSessionId: session.collaborationSessionId,
      workspaceId: session.workspaceId,
      projectId: session.projectId,
      title: session.title,
      description: session.description,
      status: session.status,
      participants: participants.map((p) => ({
        agentId: p.agentId,
        role: p.role,
        status: p.status,
        capabilities: p.capabilities,
      })),
      activeReservations: reservations.map((r) => ({
        resourceId: r.resourceId,
        resourceType: r.resourceType,
        ownerAgentId: r.ownerAgentId,
        reason: r.reason,
      })),
      verifiedDecisions: decisions
        .filter((d) => d.status === 'ACCEPTED' || d.status === 'PROMOTED_TO_MEMORY')
        .map((d) => ({
          decisionId: d.decisionId,
          decision: d.decision,
          rationale: d.rationaleSummary,
          authority: d.authority,
        })),
      activeConflicts: conflicts.map((c) => ({
        conflictId: c.conflictId,
        type: c.type,
        severity: c.severity,
        description: c.description,
      })),
    };
  }

  public async buildAgentContext(
    collaborationSessionId: string,
    agentId: string,
    taskId?: string
  ): Promise<any> {
    const session = await this.store.getSession(collaborationSessionId);
    if (!session) {
      throw new CollaborationNotFoundError(
        `Collaboration session '${collaborationSessionId}' not found.`
      );
    }

    const participants = await this.store.getParticipants(collaborationSessionId);
    const participant = participants.find((p) => p.agentId === agentId);
    if (!participant) {
      throw new CollaborationNotFoundError(
        `Agent '${agentId}' is not a participant in collaboration '${collaborationSessionId}'.`
      );
    }

    // Retrieve agent's owned tasks and reservations
    const taskOwnerships = await this.store.listTaskOwnerships(collaborationSessionId);
    const agentTasks = taskOwnerships.filter(
      (t) => t.ownerAgentId === agentId || t.collaboratorAgentIds.includes(agentId)
    );

    const reservations = await this.store.listReservations({
      collaborationSessionId,
      ownerAgentId: agentId,
      activeOnly: true,
    });

    const handoffs = await this.store.listHandoffs(collaborationSessionId, {
      targetAgentId: agentId,
    });

    const shared = await this.buildSharedContext(collaborationSessionId);
    const primaryTaskId = taskId ?? (agentTasks.length > 0 ? agentTasks[0]!.taskId : session.taskId);

    // If Phase 9.3 ContextOrchestrator is available, execute structured context orchestration
    if (this.contextOrchestrator && primaryTaskId) {
      try {
        const resourceIds = reservations.map((r) => r.resourceId);
        const request: ContextRequest = {
          workspaceId: session.workspaceId,
          projectId: session.projectId,
          repositoryId: session.repositoryIds[0] ?? 'default',
          taskText: `Collaborative execution for task ${primaryTaskId} by agent ${agentId} (${participant.role})`,
          resourceIds,
          tokenBudget: 3500,
          compressionMode: 'COMPACT',
          includeDependencies: true,
          includeBehavior: true,
          includeHealth: true,
        };

        const orchestrated = await this.contextOrchestrator.orchestrateContext(request);
        if (orchestrated.success && orchestrated.package) {
          return {
            agentId,
            role: participant.role,
            taskId: primaryTaskId,
            sharedContext: shared,
            ownedResources: reservations.map((r) => r.resourceId),
            recentHandoffs: handoffs.slice(-3),
            orchestratedContext: orchestrated.package,
          };
        }
      } catch {
        // Fallback to structured payload if orchestration encounters local limits
      }
    }

    return {
      agentId,
      role: participant.role,
      taskId: primaryTaskId,
      sharedContext: shared,
      ownedResources: reservations.map((r) => r.resourceId),
      assignedTasks: agentTasks.map((t) => t.taskId),
      recentHandoffs: handoffs.slice(-3),
    };
  }
}
