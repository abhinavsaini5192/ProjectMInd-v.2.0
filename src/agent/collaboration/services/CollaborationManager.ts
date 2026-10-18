import crypto from 'node:crypto';
import type {
  ICollaborationManager,
  CreateCollaborationSessionParams,
  JoinParticipantParams,
  RecordDecisionParams,
} from '../interfaces/ICollaborationManager.js';
import type {
  ICollaborationStore,
  CollaborationSessionQuery,
  MessageQuery,
} from '../interfaces/ICollaborationStore.js';
import type { IResourceReservationService } from '../interfaces/IResourceReservationService.js';
import type { IConflictDetector } from '../interfaces/IConflictDetector.js';
import type { IHandoffCoordinator } from '../interfaces/IHandoffCoordinator.js';
import type { ICollaborationContextService } from '../interfaces/ICollaborationContextService.js';
import type { IAgentRegistry } from '../../interfaces/IAgentRegistry.js';
import type { IEventBus } from '../../../workspace/interfaces/IEventBus.js';
import type { ProjectMemoryManager } from '../../../memory/project/services/ProjectMemoryManager.js';
import type {
  CollaborationSession,
  CollaborationSessionStatus,
  CollaborationParticipant,
  ParticipantStatus,
  TaskOwnership,
  CollaborationMessage,
  CollaborationDecision,
  CollaborationCheckpoint,
} from '../models/index.js';
import {
  CollaborationError,
  CollaborationNotFoundError,
  CollaborationConflictError,
  CollaborationSecurityError,
} from '../errors/CollaborationError.js';
import { CollaborationEventNames } from '../events/CollaborationEvents.js';

export class CollaborationManager implements ICollaborationManager {
  constructor(
    public readonly store: ICollaborationStore,
    public readonly reservations: IResourceReservationService,
    public readonly conflicts: IConflictDetector,
    public readonly handoffs: IHandoffCoordinator,
    public readonly contextService?: ICollaborationContextService | undefined,
    private readonly agentRegistry?: IAgentRegistry | undefined,
    private readonly eventBus?: IEventBus | undefined,
    private readonly memoryManager?: ProjectMemoryManager | undefined
  ) {}

  // ================= Session =================
  public async createSession(
    params: CreateCollaborationSessionParams
  ): Promise<CollaborationSession> {
    if (!params.workspaceId || !params.projectId) {
      throw new CollaborationError(
        'Both workspaceId and projectId are required to create a collaboration session.',
        'INVALID_SCOPE'
      );
    }

    // Verify coordinator agent exists and is active if registry is present
    if (this.agentRegistry) {
      const coordinator = await this.agentRegistry.get(params.coordinatorAgentId);
      if (!coordinator || coordinator.status !== 'ACTIVE') {
        throw new CollaborationError(
          `Coordinator agent '${params.coordinatorAgentId}' is not registered or active.`,
          'INVALID_COORDINATOR'
        );
      }
    }

    const sessionId = `collab_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const now = Date.now();

    const coordinatorParticipant: CollaborationParticipant = {
      agentId: params.coordinatorAgentId,
      role: 'COORDINATOR',
      status: 'ONLINE',
      capabilities: [],
      joinedAt: now,
      lastSeenAt: now,
      scope: {
        workspaceId: params.workspaceId,
        projectId: params.projectId,
        repositoryIds: params.repositoryIds ?? [],
      },
    };

    const session: CollaborationSession = {
      collaborationSessionId: sessionId,
      workspaceId: params.workspaceId,
      projectId: params.projectId,
      repositoryIds: params.repositoryIds ? [...params.repositoryIds] : ['default'],
      taskId: params.taskId,
      title: params.title,
      description: params.description,
      coordinatorAgentId: params.coordinatorAgentId,
      participants: [coordinatorParticipant],
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
      version: 1,
      metadata: params.metadata,
    };

    await this.store.saveSession(session);
    await this.store.addParticipant(sessionId, coordinatorParticipant);

    this.emitEvent(CollaborationEventNames.COLLABORATION_CREATED, session, sessionId, params.workspaceId, params.projectId);

    return session;
  }

  public async getSession(sessionId: string): Promise<CollaborationSession> {
    const session = await this.store.getSession(sessionId);
    if (!session) {
      throw new CollaborationNotFoundError(`Collaboration session '${sessionId}' not found.`);
    }
    const participants = await this.store.getParticipants(sessionId);
    return {
      ...session,
      participants,
    };
  }

  public async listSessions(query?: CollaborationSessionQuery): Promise<CollaborationSession[]> {
    return this.store.listSessions(query);
  }

  public async updateSessionStatus(
    sessionId: string,
    status: CollaborationSessionStatus
  ): Promise<CollaborationSession> {
    const session = await this.getSession(sessionId);
    const updated: CollaborationSession = {
      ...session,
      status,
      updatedAt: Date.now(),
      version: session.version + 1,
    };

    await this.store.saveSession(updated);

    if (status === 'COMPLETED') {
      this.emitEvent(CollaborationEventNames.COLLABORATION_COMPLETED, updated, sessionId, session.workspaceId, session.projectId);
    } else if (status === 'PAUSED') {
      this.emitEvent(CollaborationEventNames.COLLABORATION_PAUSED, updated, sessionId, session.workspaceId, session.projectId);
    } else if (status === 'FAILED') {
      this.emitEvent(CollaborationEventNames.COLLABORATION_FAILED, updated, sessionId, session.workspaceId, session.projectId);
    }

    return updated;
  }

  // ================= Participants =================
  public async joinParticipant(
    sessionId: string,
    params: JoinParticipantParams
  ): Promise<CollaborationParticipant> {
    const session = await this.getSession(sessionId);

    // Validate agent with registry if present
    if (this.agentRegistry) {
      const agent = await this.agentRegistry.get(params.agentId);
      if (!agent || agent.status !== 'ACTIVE') {
        throw new CollaborationError(
          `Agent '${params.agentId}' is not registered or active.`,
          'AGENT_NOT_REGISTERED'
        );
      }
    }

    const participants = await this.store.getParticipants(sessionId);
    const existing = participants.find((p) => p.agentId === params.agentId);
    if (existing && existing.status !== 'REMOVED') {
      throw new CollaborationConflictError(
        `Agent '${params.agentId}' is already participating in collaboration '${sessionId}'.`
      );
    }

    const now = Date.now();
    const participant: CollaborationParticipant = {
      agentId: params.agentId,
      role: params.role,
      status: 'ONLINE',
      capabilities: params.capabilities ? [...params.capabilities] : [],
      joinedAt: now,
      lastSeenAt: now,
      scope: {
        workspaceId: session.workspaceId,
        projectId: session.projectId,
        repositoryIds: session.repositoryIds,
      },
      metadata: params.metadata,
    };

    await this.store.addParticipant(sessionId, participant);
    this.emitEvent(CollaborationEventNames.PARTICIPANT_JOINED, participant, sessionId, session.workspaceId, session.projectId);

    return participant;
  }

  public async leaveParticipant(
    sessionId: string,
    agentId: string,
    reason?: string
  ): Promise<boolean> {
    const session = await this.getSession(sessionId);
    const participants = await this.store.getParticipants(sessionId);
    const participant = participants.find((p) => p.agentId === agentId);
    if (!participant) return false;

    const updated: CollaborationParticipant = {
      ...participant,
      status: 'REMOVED',
      lastSeenAt: Date.now(),
      metadata: { ...participant.metadata, leaveReason: reason },
    };

    await this.store.updateParticipant(sessionId, updated);
    this.emitEvent(CollaborationEventNames.PARTICIPANT_LEFT, { agentId, reason }, sessionId, session.workspaceId, session.projectId);

    return true;
  }

  public async updateParticipantStatus(
    sessionId: string,
    agentId: string,
    status: ParticipantStatus
  ): Promise<CollaborationParticipant> {
    const participants = await this.store.getParticipants(sessionId);
    const participant = participants.find((p) => p.agentId === agentId);
    if (!participant) {
      throw new CollaborationNotFoundError(
        `Participant '${agentId}' not found in collaboration '${sessionId}'.`
      );
    }

    const updated: CollaborationParticipant = {
      ...participant,
      status,
      lastSeenAt: Date.now(),
    };

    await this.store.updateParticipant(sessionId, updated);
    return updated;
  }

  // ================= Tasks =================
  public async assignTask(
    sessionId: string,
    taskId: string,
    agentId: string,
    collaboratorIds?: readonly string[]
  ): Promise<TaskOwnership> {
    const session = await this.getSession(sessionId);
    const participants = await this.store.getParticipants(sessionId);
    const participant = participants.find((p) => p.agentId === agentId);
    if (!participant || participant.status === 'REMOVED') {
      throw new CollaborationError(
        `Agent '${agentId}' is not an active participant in collaboration '${sessionId}'.`,
        'AGENT_NOT_PARTICIPANT'
      );
    }

    // Check task conflict with existing ownership
    const conflict = await this.conflicts.checkTaskConflict(sessionId, taskId, agentId);
    if (conflict) {
      throw new CollaborationConflictError(conflict.description, { conflict });
    }

    const now = Date.now();
    const ownership: TaskOwnership = {
      taskId,
      ownerAgentId: agentId,
      collaboratorAgentIds: collaboratorIds ? [...collaboratorIds] : [],
      assignedAt: now,
      updatedAt: now,
      status: 'ASSIGNED',
    };

    await this.store.saveTaskOwnership(sessionId, ownership);
    this.emitEvent(CollaborationEventNames.TASK_ASSIGNED, ownership, sessionId, session.workspaceId, session.projectId);

    return ownership;
  }

  public async unassignTask(sessionId: string, taskId: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    const existing = await this.store.getTaskOwnership(sessionId, taskId);
    if (!existing) return false;

    const removed = await this.store.deleteTaskOwnership(sessionId, taskId);
    if (removed) {
      this.emitEvent(CollaborationEventNames.TASK_UNASSIGNED, { taskId }, sessionId, session.workspaceId, session.projectId);
    }
    return removed;
  }

  public async getTaskOwnership(
    sessionId: string,
    taskId: string
  ): Promise<TaskOwnership | undefined> {
    return this.store.getTaskOwnership(sessionId, taskId);
  }

  // ================= Messaging =================
  public async sendMessage(
    message: Omit<CollaborationMessage, 'messageId' | 'timestamp' | 'provenance'>
  ): Promise<CollaborationMessage> {
    const session = await this.getSession(message.collaborationSessionId);

    // Verify sender is in collaboration
    const participants = await this.store.getParticipants(message.collaborationSessionId);
    const sender = participants.find((p) => p.agentId === message.senderAgentId);
    if (!sender || sender.status === 'REMOVED') {
      throw new CollaborationSecurityError(
        `Sender agent '${message.senderAgentId}' is not an active participant in collaboration '${message.collaborationSessionId}'.`
      );
    }

    const messageId = `msg_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const fullMessage: CollaborationMessage = {
      ...message,
      messageId,
      timestamp: Date.now(),
      provenance: 'AGENT_REPORTED', // Always preserve untrusted agent provenance
    };

    await this.store.saveMessage(fullMessage);
    return fullMessage;
  }

  public async listMessages(
    sessionId: string,
    query?: MessageQuery
  ): Promise<CollaborationMessage[]> {
    return this.store.listMessages(sessionId, query);
  }

  // ================= Decisions =================
  public async recordDecision(params: RecordDecisionParams): Promise<CollaborationDecision> {
    const session = await this.getSession(params.collaborationSessionId);

    const decisionId = `dec_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const decision: CollaborationDecision = {
      decisionId,
      projectId: session.projectId,
      collaborationSessionId: session.collaborationSessionId,
      taskId: params.taskId,
      decision: params.decision,
      rationaleSummary: params.rationaleSummary,
      alternatives: params.alternatives ? [...params.alternatives] : [],
      evidence: params.evidence ? [...params.evidence] : [],
      participants: [...params.participants],
      authority: params.authority ?? 'AGENT_PROPOSED',
      status: 'ACCEPTED',
      timestamp: Date.now(),
    };

    await this.store.saveDecision(decision);
    this.emitEvent(CollaborationEventNames.DECISION_RECORDED, decision, session.collaborationSessionId, session.workspaceId, session.projectId);

    return decision;
  }

  public async promoteDecisionToMemory(
    decisionId: string,
    promotedBy: string
  ): Promise<any> {
    const decision = await this.store.getDecision(decisionId);
    if (!decision) {
      throw new CollaborationNotFoundError(`Decision '${decisionId}' not found.`);
    }

    if (!this.memoryManager) {
      throw new CollaborationError(
        'ProjectMemoryManager is not configured on this CollaborationManager.',
        'MEMORY_INTEGRATION_UNAVAILABLE'
      );
    }

    const session = await this.getSession(decision.collaborationSessionId);

    // Formally propose candidate to ProjectMemoryManager (provenance is AGENT unless promoted by DEVELOPER)
    const candidate = await this.memoryManager.proposeCandidate({
      workspaceId: session.workspaceId,
      projectId: session.projectId,
      repositoryId: session.repositoryIds[0] ?? 'default',
      type: 'DECISION',
      title: decision.decision,
      content: decision.rationaleSummary,
      source: 'ARCHITECTURAL_DECISION_RECORD',
      provenance: 'AGENT',
      confidence: 0.9,
      authority: decision.authority === 'PROJECT_POLICY' ? 'AUTHORITATIVE' : 'NON_AUTHORITATIVE',
      evidence: decision.evidence.length > 0 ? [...decision.evidence] : [`Collaboration decision: ${decisionId}`],
      relatedResources: [],
      relatedFeatures: [],
      relatedTasks: decision.taskId ? [decision.taskId] : [],
    });

    // Promote candidate through governance pipeline
    const memory = await this.memoryManager.promoteCandidate(
      candidate.candidateId,
      decision.authority === 'PROJECT_POLICY' ? 'AUTHORITATIVE' : undefined
    );

    // Update decision status
    const updatedDecision: CollaborationDecision = {
      ...decision,
      status: 'PROMOTED_TO_MEMORY',
      promotedMemoryId: memory.memoryId,
    };
    await this.store.saveDecision(updatedDecision);

    return memory;
  }

  // ================= Recovery & Checkpointing =================
  public async createCheckpoint(sessionId: string): Promise<CollaborationCheckpoint> {
    const session = await this.getSession(sessionId);
    const taskOwnerships = await this.store.listTaskOwnerships(sessionId);
    const reservations = await this.store.listReservations({
      collaborationSessionId: sessionId,
      activeOnly: true,
    });
    const conflicts = await this.store.listConflicts({
      collaborationSessionId: sessionId,
      status: ['OPEN', 'ACKNOWLEDGED'],
    });
    const pendingHandoffs = await this.handoffs.getPendingHandoffs(sessionId);

    const checkpointId = `chk_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const checkpoint: CollaborationCheckpoint = {
      checkpointId,
      collaborationSessionId: sessionId,
      version: session.version,
      snapshotTimestamp: Date.now(),
      sessionStatus: session.status,
      activeTasks: taskOwnerships.map((t) => t.taskId),
      taskOwnerships,
      activeReservations: reservations,
      openConflicts: conflicts.map((c) => c.conflictId),
      blockers: [],
      pendingHandoffs: pendingHandoffs.map((h) => h.handoffId),
    };

    await this.store.saveCheckpoint(checkpoint);
    return checkpoint;
  }

  public async recoverFromCheckpoint(
    sessionId: string,
    checkpointId?: string
  ): Promise<CollaborationSession> {
    const session = await this.getSession(sessionId);
    let checkpoint: CollaborationCheckpoint | undefined;

    if (checkpointId) {
      const list = await this.store.listCheckpoints(sessionId);
      checkpoint = list.find((c) => c.checkpointId === checkpointId);
    } else {
      checkpoint = await this.store.getLatestCheckpoint(sessionId);
    }

    if (!checkpoint) {
      throw new CollaborationNotFoundError(
        `Checkpoint not found for recovery of collaboration session '${sessionId}'.`
      );
    }

    // Restore task ownerships
    for (const to of checkpoint.taskOwnerships) {
      await this.store.saveTaskOwnership(sessionId, to);
    }

    // Restore active reservations
    for (const res of checkpoint.activeReservations) {
      await this.store.saveReservation(res);
    }

    const updatedSession: CollaborationSession = {
      ...session,
      status: checkpoint.sessionStatus as CollaborationSessionStatus,
      updatedAt: Date.now(),
      version: session.version + 1,
    };

    await this.store.saveSession(updatedSession);
    return updatedSession;
  }

  public async handleAgentDisconnect(sessionId: string, agentId: string): Promise<void> {
    const participants = await this.store.getParticipants(sessionId);
    const participant = participants.find((p) => p.agentId === agentId);
    if (!participant) return;

    // 1. Mark participant disconnected
    const updated: CollaborationParticipant = {
      ...participant,
      status: 'DISCONNECTED',
      lastSeenAt: Date.now(),
    };
    await this.store.updateParticipant(sessionId, updated);

    // 2. Mark owned reservations as stale if expired or flag policy
    const reservations = await this.store.listReservations({
      collaborationSessionId: sessionId,
      ownerAgentId: agentId,
    });

    for (const res of reservations) {
      if (res.expiresAt <= Date.now()) {
        await this.store.saveReservation({
          ...res,
          isStale: true,
          state: 'STALE',
        });
      }
    }

    // 3. DO NOT falsely mark task complete. Preserve task ownership in BLOCKED or ASSIGNED state.
    const ownerships = await this.store.listTaskOwnerships(sessionId);
    for (const o of ownerships) {
      if (o.ownerAgentId === agentId && o.status === 'IN_PROGRESS') {
        await this.store.saveTaskOwnership(sessionId, {
          ...o,
          status: 'BLOCKED',
          notes: `Paused due to agent '${agentId}' disconnection`,
          updatedAt: Date.now(),
        });
      }
    }
  }

  private emitEvent(
    name: any,
    payload: any,
    collaborationSessionId: string,
    workspaceId: string,
    projectId: string
  ): void {
    if (!this.eventBus) return;
    try {
      this.eventBus.publish(name, {
        eventId: `ev_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
        name,
        collaborationSessionId,
        workspaceId,
        projectId,
        timestamp: Date.now(),
        payload,
      });
    } catch {
      // Safe continuation
    }
  }
}
