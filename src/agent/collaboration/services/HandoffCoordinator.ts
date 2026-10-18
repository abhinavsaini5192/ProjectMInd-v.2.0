import crypto from 'node:crypto';
import type {
  IHandoffCoordinator,
  ProposeHandoffParams,
} from '../interfaces/IHandoffCoordinator.js';
import type { ICollaborationStore } from '../interfaces/ICollaborationStore.js';
import type { AgentHandoff, TaskOwnership } from '../models/index.js';
import {
  CollaborationError,
  CollaborationNotFoundError,
  CollaborationSecurityError,
} from '../errors/CollaborationError.js';

export class HandoffCoordinator implements IHandoffCoordinator {
  constructor(private readonly store: ICollaborationStore) {}

  public async proposeHandoff(params: ProposeHandoffParams): Promise<AgentHandoff> {
    const session = await this.store.getSession(params.collaborationSessionId);
    if (!session) {
      throw new CollaborationNotFoundError(
        `Collaboration session '${params.collaborationSessionId}' not found.`
      );
    }

    // 1. Verify project scope
    if (session.projectId !== params.projectId) {
      throw new CollaborationSecurityError(
        `Project scope mismatch in handoff: session '${session.projectId}' vs handoff '${params.projectId}'`
      );
    }

    // 2. Verify source and target agents are active participants
    const participants = await this.store.getParticipants(params.collaborationSessionId);
    const source = participants.find((p) => p.agentId === params.sourceAgentId);
    const target = participants.find((p) => p.agentId === params.targetAgentId);

    if (!source) {
      throw new CollaborationError(
        `Source agent '${params.sourceAgentId}' is not a participant in collaboration '${params.collaborationSessionId}'`,
        'SOURCE_AGENT_NOT_PARTICIPANT'
      );
    }
    if (!target) {
      throw new CollaborationError(
        `Target agent '${params.targetAgentId}' is not a participant in collaboration '${params.collaborationSessionId}'`,
        'TARGET_AGENT_NOT_PARTICIPANT'
      );
    }
    if (target.status === 'REMOVED' || target.status === 'FAILED') {
      throw new CollaborationError(
        `Target agent '${params.targetAgentId}' is in '${target.status}' state and cannot accept handoffs`,
        'TARGET_AGENT_UNAVAILABLE'
      );
    }

    // 3. Verify task ownership: source agent must own the task or be a collaborator
    const ownership = await this.store.getTaskOwnership(params.collaborationSessionId, params.taskId);
    if (ownership && ownership.ownerAgentId !== params.sourceAgentId && !ownership.collaboratorAgentIds.includes(params.sourceAgentId)) {
      throw new CollaborationError(
        `Agent '${params.sourceAgentId}' does not own task '${params.taskId}' (owned by '${ownership.ownerAgentId}')`,
        'UNAUTHORIZED_TASK_HANDOFF'
      );
    }

    const handoffId = `handoff_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const handoff: AgentHandoff = {
      handoffId,
      collaborationSessionId: params.collaborationSessionId,
      sourceAgentId: params.sourceAgentId,
      targetAgentId: params.targetAgentId,
      taskId: params.taskId,
      projectId: params.projectId,
      summary: params.summary,
      completedWork: [...params.completedWork],
      remainingWork: [...params.remainingWork],
      changedResources: [...params.changedResources],
      relevantContext: params.relevantContext,
      verificationStatus: params.verificationStatus,
      blockers: params.blockers ? [...params.blockers] : [],
      timestamp: Date.now(),
      status: 'PROPOSED',
    };

    await this.store.saveHandoff(handoff);
    return handoff;
  }

  public async acceptHandoff(handoffId: string, acceptingAgentId: string): Promise<AgentHandoff> {
    const handoff = await this.store.getHandoff(handoffId);
    if (!handoff) {
      throw new CollaborationNotFoundError(`Handoff '${handoffId}' not found.`);
    }

    if (handoff.status !== 'PROPOSED') {
      throw new CollaborationError(
        `Handoff '${handoffId}' is not in PROPOSED state (currently '${handoff.status}')`,
        'INVALID_HANDOFF_STATE'
      );
    }

    if (handoff.targetAgentId !== acceptingAgentId) {
      throw new CollaborationSecurityError(
        `Agent '${acceptingAgentId}' is not the authorized target agent ('${handoff.targetAgentId}') for handoff '${handoffId}'`
      );
    }

    const accepted: AgentHandoff = {
      ...handoff,
      status: 'ACCEPTED',
    };

    await this.store.saveHandoff(accepted);

    // Automatically reassign task ownership to target agent
    const existingOwnership = await this.store.getTaskOwnership(
      handoff.collaborationSessionId,
      handoff.taskId
    );

    const now = Date.now();
    const newOwnership: TaskOwnership = {
      taskId: handoff.taskId,
      ownerAgentId: acceptingAgentId,
      collaboratorAgentIds: existingOwnership
        ? existingOwnership.collaboratorAgentIds.filter((id) => id !== acceptingAgentId)
        : [],
      reviewerAgentId: existingOwnership?.reviewerAgentId,
      verifierAgentId: existingOwnership?.verifierAgentId,
      assignedAt: existingOwnership?.assignedAt ?? now,
      updatedAt: now,
      status: 'ASSIGNED',
      notes: `Transferred via handoff '${handoffId}' from agent '${handoff.sourceAgentId}'`,
    };

    await this.store.saveTaskOwnership(handoff.collaborationSessionId, newOwnership);
    return accepted;
  }

  public async rejectHandoff(
    handoffId: string,
    rejectingAgentId: string,
    reason: string
  ): Promise<AgentHandoff> {
    const handoff = await this.store.getHandoff(handoffId);
    if (!handoff) {
      throw new CollaborationNotFoundError(`Handoff '${handoffId}' not found.`);
    }

    if (handoff.status !== 'PROPOSED') {
      throw new CollaborationError(
        `Handoff '${handoffId}' is not in PROPOSED state (currently '${handoff.status}')`,
        'INVALID_HANDOFF_STATE'
      );
    }

    if (handoff.targetAgentId !== rejectingAgentId) {
      throw new CollaborationSecurityError(
        `Agent '${rejectingAgentId}' is not authorized to reject handoff designated for '${handoff.targetAgentId}'`
      );
    }

    const rejected: AgentHandoff = {
      ...handoff,
      status: 'REJECTED',
      rejectionReason: reason,
    };

    await this.store.saveHandoff(rejected);
    return rejected;
  }

  public async getPendingHandoffs(collaborationSessionId: string): Promise<AgentHandoff[]> {
    const handoffs = await this.store.listHandoffs(collaborationSessionId);
    return handoffs.filter((h) => h.status === 'PROPOSED');
  }
}
