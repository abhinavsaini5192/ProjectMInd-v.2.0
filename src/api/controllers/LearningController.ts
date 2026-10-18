import { BaseApiController } from './BaseApiController.js';
import type { IApiRouter } from '../routing/IApiRouter.js';
import type { ApiRequest } from '../contracts/ApiRequest.js';
import type { ApiResponse } from '../contracts/ApiResponse.js';
import type { ILearningIntelligenceService } from '../../intelligence/learning/interfaces/ILearningIntelligenceService.js';
import { ApiError } from '../errors/ApiError.js';
import {
  FeedbackValidationError,
  FeedbackPoisoningError,
  CandidateNotFoundError,
  PolicyViolationError,
  RollbackError,
  ScopeViolationError,
} from '../../intelligence/learning/errors/LearningError.js';

export class LearningController extends BaseApiController {
  constructor(private readonly learningService: ILearningIntelligenceService) {
    super();
  }

  public registerRoutes(router: IApiRouter): void {
    // Feedback
    router.post('/feedback', this.handleSubmitFeedback.bind(this));
    router.get('/feedback', this.handleQueryFeedback.bind(this));
    router.get('/feedback/:id', this.handleGetFeedback.bind(this));
    router.get('/feedback/target/:targetType/:targetId', this.handleGetFeedbackForTarget.bind(this));

    // Signals
    router.post('/learning/signals/extract', this.handleExtractSignals.bind(this));
    router.get('/learning/signals', this.handleGetSignals.bind(this));

    // Candidates
    router.post('/learning/candidates/generate', this.handleGenerateCandidates.bind(this));
    router.get('/learning/candidates', this.handleGetCandidates.bind(this));
    router.get('/learning/candidates/:id', this.handleGetCandidate.bind(this));
    router.post('/learning/candidates/:id/evaluate', this.handleEvaluateCandidate.bind(this));
    router.post('/learning/candidates/:id/approve', this.handleApproveCandidate.bind(this));
    router.post('/learning/candidates/:id/reject', this.handleRejectCandidate.bind(this));

    // Deployment & Rollback
    router.post('/learning/candidates/:id/deploy', this.handleDeployCandidate.bind(this));
    router.post('/learning/deployed/:id/disable', this.handleDisableLearning.bind(this));
    router.post('/learning/deployed/:id/rollback', this.handleRollbackLearning.bind(this));
    router.get('/learning/deployed', this.handleGetDeployedLearnings.bind(this));

    // Explanation & Conflicts
    router.get('/learning/explain/:id', this.handleExplainLearning.bind(this));
    router.get('/learning/conflicts', this.handleGetConflicts.bind(this));
  }

  // --- Feedback handlers ---

  private async handleSubmitFeedback(request: ApiRequest): Promise<ApiResponse<any>> {
    const body = (request.body as Record<string, any>) ?? {};
    const workspaceId = body['workspaceId'] ?? request.context.workspaceId;
    const projectId = body['projectId'] ?? (request.context as any).projectId;

    if (!workspaceId || !projectId) {
      throw ApiError.badRequest('Both "workspaceId" and "projectId" are required.');
    }

    try {
      const feedback = await this.learningService.submitFeedback({
        workspaceId,
        projectId,
        repositoryIds: body['repositoryIds'],
        sourceType: body['sourceType'],
        sourceId: body['sourceId'] ?? request.context.userId ?? 'anonymous',
        feedbackType: body['feedbackType'],
        targetType: body['targetType'],
        targetId: body['targetId'],
        signal: body['signal'],
        value: body['value'],
        confidence: body['confidence'],
        provenance: body['provenance'],
        scope: body['scope'],
        contextReference: body['contextReference'],
        taskReference: body['taskReference'],
        sessionReference: body['sessionReference'],
        planReference: body['planReference'],
        evidenceReferences: body['evidenceReferences'],
        metadata: body['metadata'],
      });

      return this.created(request, feedback, `/feedback/${feedback.id}`);
    } catch (err) {
      this.handleKnownErrors(err);
      throw err;
    }
  }

  private getQueryParam(request: ApiRequest, key: string): string | undefined {
    return request.query?.[key] ?? (request as any).queryParams?.[key];
  }

  private async handleQueryFeedback(request: ApiRequest): Promise<ApiResponse<any>> {
    const workspaceId = this.getQueryParam(request, 'workspaceId') ?? request.context.workspaceId;
    if (!workspaceId) {
      throw ApiError.badRequest('"workspaceId" query parameter is required.');
    }

    const limitStr = this.getQueryParam(request, 'limit');
    const items = await this.learningService.queryFeedback({
      workspaceId,
      projectId: this.getQueryParam(request, 'projectId'),
      targetType: this.getQueryParam(request, 'targetType'),
      targetId: this.getQueryParam(request, 'targetId'),
      sourceType: this.getQueryParam(request, 'sourceType') as any,
      feedbackType: this.getQueryParam(request, 'feedbackType') as any,
      limit: limitStr ? parseInt(limitStr, 10) : undefined,
    });

    return this.ok(request, { count: items.length, items });
  }

  private async handleGetFeedback(request: ApiRequest): Promise<ApiResponse<any>> {
    const id = request.params['id'];
    if (!id) throw ApiError.badRequest('Missing feedback ID parameter.');

    const feedback = await this.learningService.getFeedback(id);
    if (!feedback) throw ApiError.notFound(`Feedback "${id}" not found.`);

    return this.ok(request, feedback);
  }

  private async handleGetFeedbackForTarget(request: ApiRequest): Promise<ApiResponse<any>> {
    const { targetType, targetId } = request.params;
    const workspaceId = this.getQueryParam(request, 'workspaceId') ?? request.context.workspaceId;

    if (!workspaceId || !targetType || !targetId) {
      throw ApiError.badRequest('workspaceId, targetType, and targetId are required.');
    }

    const items = await this.learningService.queryFeedback({
      workspaceId,
      targetType,
      targetId,
    });

    return this.ok(request, { count: items.length, items });
  }

  // --- Signal handlers ---

  private async handleExtractSignals(request: ApiRequest): Promise<ApiResponse<any>> {
    const body = (request.body as Record<string, any>) ?? {};
    const workspaceId = body['workspaceId'] ?? request.context.workspaceId;
    const projectId = body['projectId'] ?? (request.context as any).projectId;

    if (!workspaceId || !projectId) {
      throw ApiError.badRequest('Both "workspaceId" and "projectId" are required.');
    }

    const signals = await this.learningService.generateSignals(workspaceId, projectId);
    return this.ok(request, { count: signals.length, signals });
  }

  private async handleGetSignals(request: ApiRequest): Promise<ApiResponse<any>> {
    const workspaceId = this.getQueryParam(request, 'workspaceId') ?? request.context.workspaceId;
    if (!workspaceId) {
      throw ApiError.badRequest('"workspaceId" query parameter is required.');
    }

    const signals = await this.learningService.getSignals({
      workspaceId,
      projectId: this.getQueryParam(request, 'projectId'),
      targetType: this.getQueryParam(request, 'targetType'),
      targetId: this.getQueryParam(request, 'targetId'),
      type: this.getQueryParam(request, 'type'),
    });

    return this.ok(request, { count: signals.length, signals });
  }

  // --- Candidate handlers ---

  private async handleGenerateCandidates(request: ApiRequest): Promise<ApiResponse<any>> {
    const body = (request.body as Record<string, any>) ?? {};
    const workspaceId = body['workspaceId'] ?? request.context.workspaceId;
    const projectId = body['projectId'] ?? (request.context as any).projectId;

    if (!workspaceId || !projectId) {
      throw ApiError.badRequest('Both "workspaceId" and "projectId" are required.');
    }

    const candidates = await this.learningService.generateCandidates(workspaceId, projectId);
    return this.ok(request, { count: candidates.length, candidates });
  }

  private async handleGetCandidates(request: ApiRequest): Promise<ApiResponse<any>> {
    const workspaceId = this.getQueryParam(request, 'workspaceId') ?? request.context.workspaceId;
    if (!workspaceId) {
      throw ApiError.badRequest('"workspaceId" query parameter is required.');
    }

    const statusParam = this.getQueryParam(request, 'status');
    const candidates = await this.learningService.getCandidates({
      workspaceId,
      projectId: this.getQueryParam(request, 'projectId'),
      targetSystem: this.getQueryParam(request, 'targetSystem') as any,
      status: statusParam ? [statusParam as any] : undefined,
    });

    return this.ok(request, { count: candidates.length, candidates });
  }

  private async handleGetCandidate(request: ApiRequest): Promise<ApiResponse<any>> {
    const id = request.params['id'];
    if (!id) throw ApiError.badRequest('Missing candidate ID.');

    const candidate = await this.learningService.getCandidate(id);
    if (!candidate) throw ApiError.notFound(`Candidate "${id}" not found.`);

    return this.ok(request, candidate);
  }

  private async handleEvaluateCandidate(request: ApiRequest): Promise<ApiResponse<any>> {
    const id = request.params['id'];
    if (!id) throw ApiError.badRequest('Missing candidate ID.');

    try {
      const evaluation = await this.learningService.evaluateCandidate(id, {
        evaluatorId: request.context.userId ?? 'api-user',
      });
      return this.ok(request, evaluation);
    } catch (err) {
      this.handleKnownErrors(err);
      throw err;
    }
  }

  private async handleApproveCandidate(request: ApiRequest): Promise<ApiResponse<any>> {
    const id = request.params['id'];
    if (!id) throw ApiError.badRequest('Missing candidate ID.');

    try {
      const approver = request.context.userId ?? 'human-operator';
      const approved = await this.learningService.approveCandidate(id, approver);
      return this.ok(request, approved);
    } catch (err) {
      this.handleKnownErrors(err);
      throw err;
    }
  }

  private async handleRejectCandidate(request: ApiRequest): Promise<ApiResponse<any>> {
    const id = request.params['id'];
    if (!id) throw ApiError.badRequest('Missing candidate ID.');

    const body = (request.body as Record<string, any>) ?? {};
    const reason = body['reason'] ?? 'Rejected via API';
    const actor = request.context.userId ?? 'human-operator';

    try {
      const rejected = await this.learningService.rejectCandidate(id, reason, actor);
      return this.ok(request, rejected);
    } catch (err) {
      this.handleKnownErrors(err);
      throw err;
    }
  }

  // --- Deployment & Rollback ---

  private async handleDeployCandidate(request: ApiRequest): Promise<ApiResponse<any>> {
    const id = request.params['id'];
    if (!id) throw ApiError.badRequest('Missing candidate ID.');

    const actor = request.context.userId ?? 'deployer';

    try {
      const deployed = await this.learningService.deployCandidate(id, actor);
      return this.created(request, deployed, `/learning/deployed/${deployed.id}`);
    } catch (err) {
      this.handleKnownErrors(err);
      throw err;
    }
  }

  private async handleDisableLearning(request: ApiRequest): Promise<ApiResponse<any>> {
    const id = request.params['id'];
    if (!id) throw ApiError.badRequest('Missing deployed learning ID.');

    const actor = request.context.userId ?? 'operator';
    try {
      const disabled = await this.learningService.disableLearning(id, actor);
      return this.ok(request, disabled);
    } catch (err) {
      this.handleKnownErrors(err);
      throw err;
    }
  }

  private async handleRollbackLearning(request: ApiRequest): Promise<ApiResponse<any>> {
    const id = request.params['id'];
    if (!id) throw ApiError.badRequest('Missing deployed learning ID.');

    const body = (request.body as Record<string, any>) ?? {};
    const reason = body['reason'];
    if (!reason) {
      throw ApiError.badRequest('Field "reason" is required to execute a rollback.');
    }

    const actor = request.context.userId ?? 'operator';
    try {
      const rollback = await this.learningService.rollbackLearning(id, reason, actor);
      return this.ok(request, rollback);
    } catch (err) {
      this.handleKnownErrors(err);
      throw err;
    }
  }

  private async handleGetDeployedLearnings(request: ApiRequest): Promise<ApiResponse<any>> {
    const workspaceId = this.getQueryParam(request, 'workspaceId') ?? request.context.workspaceId;
    if (!workspaceId) {
      throw ApiError.badRequest('"workspaceId" query parameter is required.');
    }

    const statusParam = this.getQueryParam(request, 'status');
    const learnings = await this.learningService.getDeployedLearnings({
      workspaceId,
      projectId: this.getQueryParam(request, 'projectId'),
      targetSystem: this.getQueryParam(request, 'targetSystem') as any,
      status: statusParam ? [statusParam as any] : undefined,
    });

    return this.ok(request, { count: learnings.length, learnings });
  }

  // --- Explanation & Conflicts ---

  private async handleExplainLearning(request: ApiRequest): Promise<ApiResponse<any>> {
    const id = request.params['id'];
    if (!id) throw ApiError.badRequest('Missing ID to explain.');

    try {
      const explanation = await this.learningService.explainLearning(id);
      return this.ok(request, explanation);
    } catch (err) {
      this.handleKnownErrors(err);
      throw err;
    }
  }

  private async handleGetConflicts(request: ApiRequest): Promise<ApiResponse<any>> {
    const workspaceId = this.getQueryParam(request, 'workspaceId') ?? request.context.workspaceId;
    if (!workspaceId) {
      throw ApiError.badRequest('"workspaceId" query parameter is required.');
    }

    const conflicts = await this.learningService.getConflicts(
      workspaceId,
      this.getQueryParam(request, 'projectId')
    );

    return this.ok(request, { count: conflicts.length, conflicts });
  }

  private handleKnownErrors(err: unknown): void {
    if (err instanceof FeedbackValidationError) {
      throw ApiError.badRequest(err.message, err.details ? JSON.stringify(err.details) : undefined);
    }
    if (err instanceof FeedbackPoisoningError) {
      throw ApiError.forbidden(err.message);
    }
    if (err instanceof ScopeViolationError) {
      throw ApiError.forbidden(err.message);
    }
    if (err instanceof PolicyViolationError) {
      throw ApiError.conflict(err.message);
    }
    if (err instanceof CandidateNotFoundError) {
      throw ApiError.notFound(err.message);
    }
    if (err instanceof RollbackError) {
      throw ApiError.conflict(err.message);
    }
  }
}
