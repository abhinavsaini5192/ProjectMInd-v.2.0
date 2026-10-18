import type {
  CollaborationSession,
  CollaborationSessionStatus,
  CollaborationParticipant,
  CollaborationRole,
  ParticipantStatus,
  TaskOwnership,
  CollaborationMessage,
  CollaborationDecision,
  CollaborationCheckpoint,
} from '../models/index.js';
import type { CollaborationSessionQuery, MessageQuery } from './ICollaborationStore.js';

export interface CreateCollaborationSessionParams {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly repositoryIds?: readonly string[] | undefined;
  readonly title: string;
  readonly coordinatorAgentId: string;
  readonly taskId?: string | undefined;
  readonly description?: string | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
}

export interface JoinParticipantParams {
  readonly agentId: string;
  readonly role: CollaborationRole;
  readonly capabilities?: readonly string[] | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
}

export interface RecordDecisionParams {
  readonly collaborationSessionId: string;
  readonly projectId: string;
  readonly taskId?: string | undefined;
  readonly decision: string;
  readonly rationaleSummary: string;
  readonly alternatives?: readonly string[] | undefined;
  readonly evidence?: readonly string[] | undefined;
  readonly participants: readonly string[];
  readonly authority?: 'AGENT_PROPOSED' | 'TEAM_ACCEPTED' | 'SYSTEM_VERIFIED' | 'PROJECT_POLICY' | undefined;
}

export interface ICollaborationManager {
  // Session
  createSession(params: CreateCollaborationSessionParams): Promise<CollaborationSession>;
  getSession(sessionId: string): Promise<CollaborationSession>;
  listSessions(query?: CollaborationSessionQuery): Promise<CollaborationSession[]>;
  updateSessionStatus(sessionId: string, status: CollaborationSessionStatus): Promise<CollaborationSession>;

  // Participants
  joinParticipant(sessionId: string, params: JoinParticipantParams): Promise<CollaborationParticipant>;
  leaveParticipant(sessionId: string, agentId: string, reason?: string): Promise<boolean>;
  updateParticipantStatus(sessionId: string, agentId: string, status: ParticipantStatus): Promise<CollaborationParticipant>;

  // Tasks
  assignTask(sessionId: string, taskId: string, agentId: string, collaboratorIds?: readonly string[]): Promise<TaskOwnership>;
  unassignTask(sessionId: string, taskId: string): Promise<boolean>;
  getTaskOwnership(sessionId: string, taskId: string): Promise<TaskOwnership | undefined>;

  // Messaging
  sendMessage(message: Omit<CollaborationMessage, 'messageId' | 'timestamp' | 'provenance'>): Promise<CollaborationMessage>;
  listMessages(sessionId: string, query?: MessageQuery): Promise<CollaborationMessage[]>;

  // Decisions
  recordDecision(params: RecordDecisionParams): Promise<CollaborationDecision>;
  promoteDecisionToMemory(decisionId: string, promotedBy: string): Promise<any>;

  // Recovery & Checkpointing
  createCheckpoint(sessionId: string): Promise<CollaborationCheckpoint>;
  recoverFromCheckpoint(sessionId: string, checkpointId?: string): Promise<CollaborationSession>;
  handleAgentDisconnect(sessionId: string, agentId: string): Promise<void>;
}
