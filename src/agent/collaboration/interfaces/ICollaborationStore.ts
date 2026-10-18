import type {
  CollaborationSession,
  CollaborationSessionStatus,
  CollaborationParticipant,
  TaskOwnership,
  ResourceReservation,
  CollaborationConflict,
  CollaborationConflictStatus,
  AgentHandoff,
  CollaborationMessage,
  CollaborationMessageType,
  CollaborationDecision,
  CollaborationCheckpoint,
} from '../models/index.js';

export interface CollaborationSessionQuery {
  readonly workspaceId?: string | undefined;
  readonly projectId?: string | undefined;
  readonly status?: readonly CollaborationSessionStatus[] | undefined;
  readonly coordinatorAgentId?: string | undefined;
}

export interface ReservationQuery {
  readonly collaborationSessionId?: string | undefined;
  readonly resourceId?: string | undefined;
  readonly ownerAgentId?: string | undefined;
  readonly activeOnly?: boolean | undefined;
}

export interface ConflictQuery {
  readonly collaborationSessionId?: string | undefined;
  readonly status?: readonly CollaborationConflictStatus[] | undefined;
}

export interface MessageQuery {
  readonly agentId?: string | undefined;
  readonly type?: CollaborationMessageType | undefined;
  readonly limit?: number | undefined;
}

export interface ICollaborationStore {
  // Session
  saveSession(session: CollaborationSession): Promise<void>;
  getSession(sessionId: string): Promise<CollaborationSession | undefined>;
  listSessions(query?: CollaborationSessionQuery): Promise<CollaborationSession[]>;
  deleteSession(sessionId: string): Promise<boolean>;

  // Participants
  addParticipant(sessionId: string, participant: CollaborationParticipant): Promise<void>;
  updateParticipant(sessionId: string, participant: CollaborationParticipant): Promise<void>;
  removeParticipant(sessionId: string, agentId: string): Promise<boolean>;
  getParticipants(sessionId: string): Promise<CollaborationParticipant[]>;

  // Tasks
  saveTaskOwnership(sessionId: string, ownership: TaskOwnership): Promise<void>;
  getTaskOwnership(sessionId: string, taskId: string): Promise<TaskOwnership | undefined>;
  listTaskOwnerships(sessionId: string): Promise<TaskOwnership[]>;
  deleteTaskOwnership(sessionId: string, taskId: string): Promise<boolean>;

  // Reservations
  saveReservation(reservation: ResourceReservation): Promise<void>;
  getReservation(reservationId: string): Promise<ResourceReservation | undefined>;
  listReservations(query?: ReservationQuery): Promise<ResourceReservation[]>;
  deleteReservation(reservationId: string): Promise<boolean>;

  // Conflicts
  saveConflict(conflict: CollaborationConflict): Promise<void>;
  getConflict(conflictId: string): Promise<CollaborationConflict | undefined>;
  listConflicts(query?: ConflictQuery): Promise<CollaborationConflict[]>;

  // Handoffs
  saveHandoff(handoff: AgentHandoff): Promise<void>;
  getHandoff(handoffId: string): Promise<AgentHandoff | undefined>;
  listHandoffs(sessionId: string, query?: { sourceAgentId?: string; targetAgentId?: string; taskId?: string }): Promise<AgentHandoff[]>;

  // Messages
  saveMessage(message: CollaborationMessage): Promise<void>;
  listMessages(sessionId: string, query?: MessageQuery): Promise<CollaborationMessage[]>;

  // Decisions
  saveDecision(decision: CollaborationDecision): Promise<void>;
  getDecision(decisionId: string): Promise<CollaborationDecision | undefined>;
  listDecisions(sessionId: string): Promise<CollaborationDecision[]>;

  // Checkpoints
  saveCheckpoint(checkpoint: CollaborationCheckpoint): Promise<void>;
  getLatestCheckpoint(sessionId: string): Promise<CollaborationCheckpoint | undefined>;
  listCheckpoints(sessionId: string): Promise<CollaborationCheckpoint[]>;
}
