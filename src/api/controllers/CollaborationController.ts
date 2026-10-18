import { BaseApiController } from './BaseApiController.js';
import type { IApiRouter } from '../routing/IApiRouter.js';
import type { ApiRequest } from '../contracts/ApiRequest.js';
import type { ApiResponse } from '../contracts/ApiResponse.js';
import type { ICollaborationManager } from '../../agent/collaboration/interfaces/ICollaborationManager.js';
import { ApiError } from '../errors/ApiError.js';
import {
  CollaborationNotFoundError,
  CollaborationConflictError,
  CollaborationSecurityError,
} from '../../agent/collaboration/errors/CollaborationError.js';

export class CollaborationController extends BaseApiController {
  constructor(private readonly collaborationManager: ICollaborationManager) {
    super();
  }

  public registerRoutes(router: IApiRouter): void {
    router.post('/collaborations', this.handleCreateSession.bind(this));
    router.get('/collaborations', this.handleListSessions.bind(this));
    router.get('/collaborations/:id', this.handleGetSession.bind(this));
    router.patch('/collaborations/:id/status', this.handleUpdateStatus.bind(this));

    router.post('/collaborations/:id/participants', this.handleJoinParticipant.bind(this));
    router.delete('/collaborations/:id/participants/:agentId', this.handleLeaveParticipant.bind(this));

    router.post('/collaborations/:id/tasks/assign', this.handleAssignTask.bind(this));
    router.post('/collaborations/:id/tasks/unassign', this.handleUnassignTask.bind(this));

    router.post('/collaborations/:id/reservations', this.handleReserveResource.bind(this));
    router.delete('/collaborations/:id/reservations/:reservationId', this.handleReleaseReservation.bind(this));

    router.get('/collaborations/:id/conflicts', this.handleDetectConflicts.bind(this));

    router.post('/collaborations/:id/handoffs', this.handleProposeHandoff.bind(this));
    router.post('/collaborations/:id/handoffs/:handoffId/accept', this.handleAcceptHandoff.bind(this));
    router.post('/collaborations/:id/handoffs/:handoffId/reject', this.handleRejectHandoff.bind(this));

    router.post('/collaborations/:id/messages', this.handleSendMessage.bind(this));
    router.get('/collaborations/:id/messages', this.handleListMessages.bind(this));

    router.post('/collaborations/:id/decisions', this.handleRecordDecision.bind(this));
    router.post('/collaborations/:id/decisions/:decisionId/promote', this.handlePromoteDecision.bind(this));

    router.post('/collaborations/:id/checkpoints', this.handleCreateCheckpoint.bind(this));
    router.post('/collaborations/:id/recover', this.handleRecoverCheckpoint.bind(this));
  }

  private async handleCreateSession(request: ApiRequest): Promise<ApiResponse<any>> {
    const body = (request.body as Record<string, any>) ?? {};
    if (!body['title'] || !body['coordinatorAgentId']) {
      throw ApiError.badRequest('Fields "title" and "coordinatorAgentId" are required.');
    }

    const workspaceId = body['workspaceId'] ?? request.context.workspaceId;
    const projectId = body['projectId'] ?? (request.context as any).projectId;
    if (!workspaceId || !projectId) {
      throw ApiError.badRequest('Both "workspaceId" and "projectId" are required.');
    }

    this.checkScope(request, workspaceId, projectId);

    const session = await this.collaborationManager.createSession({
      workspaceId,
      projectId,
      repositoryIds: body['repositoryIds'] ?? ['default'],
      title: body['title'],
      coordinatorAgentId: body['coordinatorAgentId'],
      taskId: body['taskId'],
      description: body['description'],
      metadata: body['metadata'],
    });

    return this.created(request, session, `/collaborations/${session.collaborationSessionId}`);
  }

  private async handleListSessions(request: ApiRequest): Promise<ApiResponse<any>> {
    const workspaceId = request.query['workspaceId'] ?? request.context.workspaceId;
    const projectId = request.query['projectId'] ?? (request.context as any).projectId;

    this.checkScope(request, workspaceId, projectId);

    const sessions = await this.collaborationManager.listSessions({
      workspaceId,
      projectId,
    });

    return this.ok(request, { count: sessions.length, sessions });
  }

  private async handleGetSession(request: ApiRequest): Promise<ApiResponse<any>> {
    const sessionId = request.params['id'];
    if (!sessionId) throw ApiError.badRequest('Parameter "id" is required.');

    try {
      const session = await this.collaborationManager.getSession(sessionId);
      this.checkScope(request, session.workspaceId, session.projectId);
      return this.ok(request, session);
    } catch (err: any) {
      if (err instanceof CollaborationNotFoundError) {
        throw ApiError.notFound(err.message);
      }
      throw err;
    }
  }

  private async handleUpdateStatus(request: ApiRequest): Promise<ApiResponse<any>> {
    const sessionId = request.params['id'];
    const body = (request.body as Record<string, any>) ?? {};
    if (!sessionId || !body['status']) {
      throw ApiError.badRequest('Parameters "id" and "status" are required.');
    }

    const session = await this.collaborationManager.updateSessionStatus(sessionId, body['status']);
    return this.ok(request, session);
  }

  private async handleJoinParticipant(request: ApiRequest): Promise<ApiResponse<any>> {
    const sessionId = request.params['id'];
    const body = (request.body as Record<string, any>) ?? {};
    if (!sessionId || !body['agentId'] || !body['role']) {
      throw ApiError.badRequest('Fields "agentId" and "role" are required.');
    }

    try {
      const participant = await this.collaborationManager.joinParticipant(sessionId, {
        agentId: body['agentId'],
        role: body['role'],
        capabilities: body['capabilities'],
        metadata: body['metadata'],
      });
      return this.created(request, participant);
    } catch (err: any) {
      if (err instanceof CollaborationConflictError) {
        throw ApiError.conflict(err.message);
      }
      if (err instanceof CollaborationNotFoundError) {
        throw ApiError.notFound(err.message);
      }
      throw err;
    }
  }

  private async handleLeaveParticipant(request: ApiRequest): Promise<ApiResponse<any>> {
    const sessionId = request.params['id'];
    const agentId = request.params['agentId'];
    if (!sessionId || !agentId) {
      throw ApiError.badRequest('Parameters "id" and "agentId" are required.');
    }

    const removed = await this.collaborationManager.leaveParticipant(sessionId, agentId);
    return this.ok(request, { agentId, removed });
  }

  private async handleAssignTask(request: ApiRequest): Promise<ApiResponse<any>> {
    const sessionId = request.params['id'];
    const body = (request.body as Record<string, any>) ?? {};
    if (!sessionId || !body['taskId'] || !body['agentId']) {
      throw ApiError.badRequest('Fields "taskId" and "agentId" are required.');
    }

    try {
      const ownership = await this.collaborationManager.assignTask(
        sessionId,
        body['taskId'],
        body['agentId'],
        body['collaboratorIds']
      );
      return this.ok(request, ownership);
    } catch (err: any) {
      if (err instanceof CollaborationConflictError) {
        throw ApiError.conflict(err.message);
      }
      throw err;
    }
  }

  private async handleUnassignTask(request: ApiRequest): Promise<ApiResponse<any>> {
    const sessionId = request.params['id'];
    const body = (request.body as Record<string, any>) ?? {};
    if (!sessionId || !body['taskId']) {
      throw ApiError.badRequest('Field "taskId" is required.');
    }

    const unassigned = await this.collaborationManager.unassignTask(sessionId, body['taskId']);
    return this.ok(request, { taskId: body['taskId'], unassigned });
  }

  private async handleReserveResource(request: ApiRequest): Promise<ApiResponse<any>> {
    const sessionId = request.params['id'];
    const body = (request.body as Record<string, any>) ?? {};
    if (!sessionId || !body['resourceId'] || !body['ownerAgentId']) {
      throw ApiError.badRequest('Fields "resourceId" and "ownerAgentId" are required.');
    }

    try {
      const reservation = await (this.collaborationManager as any).reservations.reserve({
        collaborationSessionId: sessionId,
        ownerAgentId: body['ownerAgentId'],
        resourceType: body['resourceType'] ?? 'FILE',
        resourceId: body['resourceId'],
        reason: body['reason'] ?? 'Task implementation reservation',
        ttlMs: body['ttlMs'],
      });
      return this.created(request, reservation);
    } catch (err: any) {
      if (err instanceof CollaborationConflictError) {
        throw ApiError.conflict(err.message);
      }
      throw err;
    }
  }

  private async handleReleaseReservation(request: ApiRequest): Promise<ApiResponse<any>> {
    const sessionId = request.params['id'];
    const reservationId = request.params['reservationId'];
    const agentId = request.query['agentId'] ?? (request.body as any)?.['agentId'];
    if (!sessionId || !reservationId || !agentId) {
      throw ApiError.badRequest('Parameters "id", "reservationId" and "agentId" are required.');
    }

    const released = await (this.collaborationManager as any).reservations.release(reservationId, agentId);
    return this.ok(request, { reservationId, released });
  }

  private async handleDetectConflicts(request: ApiRequest): Promise<ApiResponse<any>> {
    const sessionId = request.params['id'];
    if (!sessionId) throw ApiError.badRequest('Parameter "id" is required.');

    const conflicts = await (this.collaborationManager as any).conflicts.detectConflicts(sessionId);
    return this.ok(request, { count: conflicts.length, conflicts });
  }

  private async handleProposeHandoff(request: ApiRequest): Promise<ApiResponse<any>> {
    const sessionId = request.params['id'];
    const body = (request.body as Record<string, any>) ?? {};
    if (!sessionId || !body['sourceAgentId'] || !body['targetAgentId'] || !body['taskId']) {
      throw ApiError.badRequest('Fields "sourceAgentId", "targetAgentId", and "taskId" are required.');
    }

    const session = await this.collaborationManager.getSession(sessionId);
    try {
      const handoff = await (this.collaborationManager as any).handoffs.proposeHandoff({
        collaborationSessionId: sessionId,
        sourceAgentId: body['sourceAgentId'],
        targetAgentId: body['targetAgentId'],
        taskId: body['taskId'],
        projectId: session.projectId,
        summary: body['summary'] ?? 'Agent task handoff',
        completedWork: body['completedWork'] ?? [],
        remainingWork: body['remainingWork'] ?? [],
        changedResources: body['changedResources'] ?? [],
        relevantContext: body['relevantContext'],
        verificationStatus: body['verificationStatus'] ?? 'AGENT_REPORTED',
        blockers: body['blockers'],
      });
      return this.created(request, handoff);
    } catch (err: any) {
      if (err instanceof CollaborationSecurityError) {
        throw ApiError.forbidden(err.message);
      }
      throw err;
    }
  }

  private async handleAcceptHandoff(request: ApiRequest): Promise<ApiResponse<any>> {
    const sessionId = request.params['id'];
    const handoffId = request.params['handoffId'];
    const body = (request.body as Record<string, any>) ?? {};
    if (!sessionId || !handoffId || !body['acceptingAgentId']) {
      throw ApiError.badRequest('Fields "handoffId" and "acceptingAgentId" are required.');
    }

    try {
      const accepted = await (this.collaborationManager as any).handoffs.acceptHandoff(
        handoffId,
        body['acceptingAgentId']
      );
      return this.ok(request, accepted);
    } catch (err: any) {
      if (err instanceof CollaborationSecurityError) {
        throw ApiError.forbidden(err.message);
      }
      throw err;
    }
  }

  private async handleRejectHandoff(request: ApiRequest): Promise<ApiResponse<any>> {
    const sessionId = request.params['id'];
    const handoffId = request.params['handoffId'];
    const body = (request.body as Record<string, any>) ?? {};
    if (!sessionId || !handoffId || !body['rejectingAgentId']) {
      throw ApiError.badRequest('Fields "handoffId" and "rejectingAgentId" are required.');
    }

    const rejected = await (this.collaborationManager as any).handoffs.rejectHandoff(
      handoffId,
      body['rejectingAgentId'],
      body['reason'] ?? 'Rejected by target agent'
    );
    return this.ok(request, rejected);
  }

  private async handleSendMessage(request: ApiRequest): Promise<ApiResponse<any>> {
    const sessionId = request.params['id'];
    const body = (request.body as Record<string, any>) ?? {};
    if (!sessionId || !body['senderAgentId'] || !body['type'] || !body['payload']) {
      throw ApiError.badRequest('Fields "senderAgentId", "type", and "payload" are required.');
    }

    const session = await this.collaborationManager.getSession(sessionId);
    try {
      const msg = await this.collaborationManager.sendMessage({
        collaborationSessionId: sessionId,
        senderAgentId: body['senderAgentId'],
        recipientAgentIds: body['recipientAgentIds'] ?? [],
        taskId: body['taskId'],
        projectId: session.projectId,
        workspaceId: session.workspaceId,
        type: body['type'],
        payload: body['payload'],
        correlationId: body['correlationId'] ?? `corr_${Date.now()}`,
      });
      return this.created(request, msg);
    } catch (err: any) {
      if (err instanceof CollaborationSecurityError) {
        throw ApiError.forbidden(err.message);
      }
      throw err;
    }
  }

  private async handleListMessages(request: ApiRequest): Promise<ApiResponse<any>> {
    const sessionId = request.params['id'];
    if (!sessionId) throw ApiError.badRequest('Parameter "id" is required.');

    const messages = await this.collaborationManager.listMessages(sessionId, {
      agentId: request.query['agentId'],
      type: request.query['type'] as any,
      limit: request.query['limit'] ? Number(request.query['limit']) : 50,
    });
    return this.ok(request, { count: messages.length, messages });
  }

  private async handleRecordDecision(request: ApiRequest): Promise<ApiResponse<any>> {
    const sessionId = request.params['id'];
    const body = (request.body as Record<string, any>) ?? {};
    if (!sessionId || !body['decision'] || !body['rationaleSummary']) {
      throw ApiError.badRequest('Fields "decision" and "rationaleSummary" are required.');
    }

    const session = await this.collaborationManager.getSession(sessionId);
    const decision = await this.collaborationManager.recordDecision({
      collaborationSessionId: sessionId,
      projectId: session.projectId,
      taskId: body['taskId'],
      decision: body['decision'],
      rationaleSummary: body['rationaleSummary'],
      alternatives: body['alternatives'],
      evidence: body['evidence'],
      participants: body['participants'] ?? [],
      authority: body['authority'],
    });

    return this.created(request, decision);
  }

  private async handlePromoteDecision(request: ApiRequest): Promise<ApiResponse<any>> {
    const sessionId = request.params['id'];
    const decisionId = request.params['decisionId'];
    const body = (request.body as Record<string, any>) ?? {};
    if (!sessionId || !decisionId) {
      throw ApiError.badRequest('Parameters "id" and "decisionId" are required.');
    }

    const memory = await this.collaborationManager.promoteDecisionToMemory(
      decisionId,
      body['promotedBy'] ?? 'DEVELOPER'
    );
    return this.ok(request, memory);
  }

  private async handleCreateCheckpoint(request: ApiRequest): Promise<ApiResponse<any>> {
    const sessionId = request.params['id'];
    if (!sessionId) throw ApiError.badRequest('Parameter "id" is required.');

    const checkpoint = await this.collaborationManager.createCheckpoint(sessionId);
    return this.created(request, checkpoint);
  }

  private async handleRecoverCheckpoint(request: ApiRequest): Promise<ApiResponse<any>> {
    const sessionId = request.params['id'];
    const body = (request.body as Record<string, any>) ?? {};
    if (!sessionId) throw ApiError.badRequest('Parameter "id" is required.');

    const session = await this.collaborationManager.recoverFromCheckpoint(sessionId, body['checkpointId']);
    return this.ok(request, session);
  }

  private checkScope(request: ApiRequest, workspaceId?: string, projectId?: string): void {
    const sec = (request.context as any).security ?? (request.context as any).securityContext;
    if (sec && typeof sec.isGlobalAdmin === 'function' && !sec.isGlobalAdmin()) {
      if (sec.workspaceId && sec.workspaceId !== '*' && workspaceId && sec.workspaceId !== workspaceId) {
        throw ApiError.invalidScope(`Workspace scope violation: ${workspaceId}`);
      }
      if (sec.projectId && sec.projectId !== '*' && projectId && sec.projectId !== projectId) {
        throw ApiError.invalidScope(`Project scope violation: ${projectId}`);
      }
    }
  }
}
