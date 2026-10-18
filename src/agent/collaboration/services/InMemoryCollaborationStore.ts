import type {
  CollaborationSession,
  CollaborationParticipant,
  TaskOwnership,
  ResourceReservation,
  CollaborationConflict,
  AgentHandoff,
  CollaborationMessage,
  CollaborationDecision,
  CollaborationCheckpoint,
} from '../models/index.js';
import type {
  ICollaborationStore,
  CollaborationSessionQuery,
  ReservationQuery,
  ConflictQuery,
  MessageQuery,
} from '../interfaces/ICollaborationStore.js';

export class InMemoryCollaborationStore implements ICollaborationStore {
  private readonly sessions = new Map<string, CollaborationSession>();
  private readonly participants = new Map<string, Map<string, CollaborationParticipant>>();
  private readonly taskOwnerships = new Map<string, Map<string, TaskOwnership>>();
  private readonly reservations = new Map<string, ResourceReservation>();
  private readonly conflicts = new Map<string, CollaborationConflict>();
  private readonly handoffs = new Map<string, AgentHandoff>();
  private readonly messages = new Map<string, CollaborationMessage[]>();
  private readonly decisions = new Map<string, CollaborationDecision>();
  private readonly checkpoints = new Map<string, CollaborationCheckpoint[]>();

  // ================= Sessions =================
  public async saveSession(session: CollaborationSession): Promise<void> {
    this.sessions.set(session.collaborationSessionId, session);
    if (!this.participants.has(session.collaborationSessionId)) {
      this.participants.set(session.collaborationSessionId, new Map());
    }
    if (!this.taskOwnerships.has(session.collaborationSessionId)) {
      this.taskOwnerships.set(session.collaborationSessionId, new Map());
    }
  }

  public async getSession(sessionId: string): Promise<CollaborationSession | undefined> {
    return this.sessions.get(sessionId);
  }

  public async listSessions(query?: CollaborationSessionQuery): Promise<CollaborationSession[]> {
    const list = Array.from(this.sessions.values());
    return list.filter((s) => {
      if (query?.workspaceId && s.workspaceId !== query.workspaceId) return false;
      if (query?.projectId && s.projectId !== query.projectId) return false;
      if (query?.status && query.status.length > 0 && !query.status.includes(s.status)) return false;
      if (query?.coordinatorAgentId && s.coordinatorAgentId !== query.coordinatorAgentId) return false;
      return true;
    });
  }

  public async deleteSession(sessionId: string): Promise<boolean> {
    this.participants.delete(sessionId);
    this.taskOwnerships.delete(sessionId);
    this.messages.delete(sessionId);
    this.checkpoints.delete(sessionId);
    return this.sessions.delete(sessionId);
  }

  // ================= Participants =================
  public async addParticipant(
    sessionId: string,
    participant: CollaborationParticipant
  ): Promise<void> {
    let pMap = this.participants.get(sessionId);
    if (!pMap) {
      pMap = new Map();
      this.participants.set(sessionId, pMap);
    }
    pMap.set(participant.agentId, participant);
  }

  public async updateParticipant(
    sessionId: string,
    participant: CollaborationParticipant
  ): Promise<void> {
    const pMap = this.participants.get(sessionId);
    if (pMap) {
      pMap.set(participant.agentId, participant);
    }
  }

  public async removeParticipant(sessionId: string, agentId: string): Promise<boolean> {
    const pMap = this.participants.get(sessionId);
    return pMap ? pMap.delete(agentId) : false;
  }

  public async getParticipants(sessionId: string): Promise<CollaborationParticipant[]> {
    const pMap = this.participants.get(sessionId);
    return pMap ? Array.from(pMap.values()) : [];
  }

  // ================= Tasks =================
  public async saveTaskOwnership(sessionId: string, ownership: TaskOwnership): Promise<void> {
    let tMap = this.taskOwnerships.get(sessionId);
    if (!tMap) {
      tMap = new Map();
      this.taskOwnerships.set(sessionId, tMap);
    }
    tMap.set(ownership.taskId, ownership);
  }

  public async getTaskOwnership(
    sessionId: string,
    taskId: string
  ): Promise<TaskOwnership | undefined> {
    const tMap = this.taskOwnerships.get(sessionId);
    return tMap?.get(taskId);
  }

  public async listTaskOwnerships(sessionId: string): Promise<TaskOwnership[]> {
    const tMap = this.taskOwnerships.get(sessionId);
    return tMap ? Array.from(tMap.values()) : [];
  }

  public async deleteTaskOwnership(sessionId: string, taskId: string): Promise<boolean> {
    const tMap = this.taskOwnerships.get(sessionId);
    return tMap ? tMap.delete(taskId) : false;
  }

  // ================= Reservations =================
  public async saveReservation(reservation: ResourceReservation): Promise<void> {
    this.reservations.set(reservation.reservationId, reservation);
  }

  public async getReservation(reservationId: string): Promise<ResourceReservation | undefined> {
    return this.reservations.get(reservationId);
  }

  public async listReservations(query?: ReservationQuery): Promise<ResourceReservation[]> {
    const list = Array.from(this.reservations.values());
    const now = Date.now();
    return list.filter((r) => {
      if (query?.collaborationSessionId && r.collaborationSessionId !== query.collaborationSessionId)
        return false;
      if (query?.resourceId && r.resourceId !== query.resourceId) return false;
      if (query?.ownerAgentId && r.ownerAgentId !== query.ownerAgentId) return false;
      if (query?.activeOnly) {
        if (r.state === 'UNOWNED' || r.state === 'STALE' || r.expiresAt <= now) return false;
      }
      return true;
    });
  }

  public async deleteReservation(reservationId: string): Promise<boolean> {
    return this.reservations.delete(reservationId);
  }

  // ================= Conflicts =================
  public async saveConflict(conflict: CollaborationConflict): Promise<void> {
    this.conflicts.set(conflict.conflictId, conflict);
  }

  public async getConflict(conflictId: string): Promise<CollaborationConflict | undefined> {
    return this.conflicts.get(conflictId);
  }

  public async listConflicts(query?: ConflictQuery): Promise<CollaborationConflict[]> {
    const list = Array.from(this.conflicts.values());
    return list.filter((c) => {
      if (query?.collaborationSessionId && c.collaborationSessionId !== query.collaborationSessionId)
        return false;
      if (query?.status && query.status.length > 0 && !query.status.includes(c.status))
        return false;
      return true;
    });
  }

  // ================= Handoffs =================
  public async saveHandoff(handoff: AgentHandoff): Promise<void> {
    this.handoffs.set(handoff.handoffId, handoff);
  }

  public async getHandoff(handoffId: string): Promise<AgentHandoff | undefined> {
    return this.handoffs.get(handoffId);
  }

  public async listHandoffs(
    sessionId: string,
    query?: { sourceAgentId?: string; targetAgentId?: string; taskId?: string }
  ): Promise<AgentHandoff[]> {
    const list = Array.from(this.handoffs.values()).filter(
      (h) => h.collaborationSessionId === sessionId
    );
    return list.filter((h) => {
      if (query?.sourceAgentId && h.sourceAgentId !== query.sourceAgentId) return false;
      if (query?.targetAgentId && h.targetAgentId !== query.targetAgentId) return false;
      if (query?.taskId && h.taskId !== query.taskId) return false;
      return true;
    });
  }

  // ================= Messages =================
  public async saveMessage(message: CollaborationMessage): Promise<void> {
    let list = this.messages.get(message.collaborationSessionId);
    if (!list) {
      list = [];
      this.messages.set(message.collaborationSessionId, list);
    }
    list.push(message);
  }

  public async listMessages(
    sessionId: string,
    query?: MessageQuery
  ): Promise<CollaborationMessage[]> {
    const list = this.messages.get(sessionId) ?? [];
    let filtered = list.filter((m) => {
      if (query?.type && m.type !== query.type) return false;
      if (
        query?.agentId &&
        m.senderAgentId !== query.agentId &&
        m.recipientAgentIds.length > 0 &&
        !m.recipientAgentIds.includes(query.agentId)
      ) {
        return false;
      }
      return true;
    });

    if (query?.limit && query.limit > 0) {
      filtered = filtered.slice(-query.limit);
    }
    return filtered;
  }

  // ================= Decisions =================
  public async saveDecision(decision: CollaborationDecision): Promise<void> {
    this.decisions.set(decision.decisionId, decision);
  }

  public async getDecision(decisionId: string): Promise<CollaborationDecision | undefined> {
    return this.decisions.get(decisionId);
  }

  public async listDecisions(sessionId: string): Promise<CollaborationDecision[]> {
    return Array.from(this.decisions.values()).filter(
      (d) => d.collaborationSessionId === sessionId
    );
  }

  // ================= Checkpoints =================
  public async saveCheckpoint(checkpoint: CollaborationCheckpoint): Promise<void> {
    let list = this.checkpoints.get(checkpoint.collaborationSessionId);
    if (!list) {
      list = [];
      this.checkpoints.set(checkpoint.collaborationSessionId, list);
    }
    list.push(checkpoint);
  }

  public async getLatestCheckpoint(
    sessionId: string
  ): Promise<CollaborationCheckpoint | undefined> {
    const list = this.checkpoints.get(sessionId);
    if (!list || list.length === 0) return undefined;
    return list[list.length - 1];
  }

  public async listCheckpoints(sessionId: string): Promise<CollaborationCheckpoint[]> {
    return this.checkpoints.get(sessionId) ?? [];
  }
}
