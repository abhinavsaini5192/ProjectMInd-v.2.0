import { BaseApiController } from './BaseApiController.js';
import type { IApiRouter } from '../routing/IApiRouter.js';
import type { ApiRequest } from '../contracts/ApiRequest.js';
import type { ApiResponse } from '../contracts/ApiResponse.js';
import type { IVerificationProcessor } from '../../verification/interfaces/IVerificationProcessor.js';
import type { IVerificationQueryService } from '../../verification/interfaces/IVerificationQueryService.js';
import type { RawVerificationInput } from '../../verification/interfaces/IVerificationNormalizer.js';
import type { VerificationScopeContext } from '../../verification/interfaces/IVerificationValidator.js';
import type { VerificationQueryParams } from '../../verification/interfaces/IVerificationStore.js';
import { ApiError } from '../errors/ApiError.js';

export class VerificationController extends BaseApiController {
  public constructor(
    private readonly processor: IVerificationProcessor,
    private readonly queryService?: IVerificationQueryService | undefined
  ) {
    super();
  }

  public registerRoutes(router: IApiRouter): void {
    const basePath = '/v1/workspaces/:workspaceId/repositories/:repositoryId/verification';

    // Verification intake and processing
    router.post(`${basePath}/process`, this.processVerification.bind(this));

    // Verification queries (if queryService available)
    if (this.queryService) {
      router.get(`${basePath}/records/:verificationId`, this.getVerification.bind(this));
      router.get(`${basePath}/records`, this.listVerifications.bind(this));
      router.get(`${basePath}/tasks/:taskId/summary`, this.getTaskSummary.bind(this));
      router.get(`${basePath}/tasks/:taskId/timeline`, this.getTaskTimeline.bind(this));
      router.get(`${basePath}/tasks/:taskId/completion-evidence`, this.getCompletionEvidence.bind(this));
      router.get(`${basePath}/features/:featureId`, this.getFeatureVerifications.bind(this));
    }
  }

  public async processVerification(request: ApiRequest): Promise<ApiResponse> {
    const { workspaceId, repositoryId } = request.params;
    const body = (request.body as Record<string, any>) ?? {};

    const input: RawVerificationInput = {
      verificationId: body.verificationId,
      taskId: body.taskId ?? request.params['taskId'],
      contextSessionId: body.contextSessionId,
      agentSessionId: body.agentSessionId,
      workspaceId,
      repositoryId,
      verificationType: body.verificationType ?? 'TEST_EXECUTION',
      status: body.status ?? 'PASSED',
      passed: body.passed,
      source: body.source ?? 'AGENT_VERIFICATION',
      reportedBy: body.reportedBy,
      sourceId: body.sourceId,
      confidence: body.confidence,
      summary: body.summary ?? 'Verification report via API',
      diagnostics: body.diagnostics,
      evidence: body.evidence,
      testResults: body.testResults,
      buildPassed: body.buildPassed,
      duration: body.duration,
      metadata: body.metadata,
      startedAt: body.startedAt,
      completedAt: body.completedAt,
    };

    const scopeContext: VerificationScopeContext = {
      workspaceId: workspaceId ?? '',
      repositoryId: repositoryId ?? '',
      agentSessionId: body.agentSessionId,
      taskId: input.taskId,
    };

    const result = await this.processor.processVerification(input, scopeContext);
    return this.created(
      request,
      result,
      `/v1/workspaces/${workspaceId}/repositories/${repositoryId}/verification/records/${result.record.verificationId}`
    );
  }

  public async getVerification(request: ApiRequest): Promise<ApiResponse> {
    if (!this.queryService) {
      throw ApiError.notImplemented('Verification query service not available');
    }

    const { verificationId } = request.params;
    if (!verificationId) {
      throw ApiError.badRequest('verificationId parameter is required');
    }

    const record = await this.queryService.getVerification(verificationId);
    if (!record) {
      throw ApiError.notFound(`Verification record '${verificationId}' not found`);
    }

    return this.ok(request, record);
  }

  public async listVerifications(request: ApiRequest): Promise<ApiResponse> {
    if (!this.queryService) {
      throw ApiError.notImplemented('Verification query service not available');
    }

    const { workspaceId, repositoryId } = request.params;
    const query = request.query;

    const queryParams: VerificationQueryParams = {
      workspaceId,
      repositoryId,
      taskId: query['taskId'],
      featureId: query['featureId'],
      verificationType: query['verificationType'] as any,
      status: query['status'] as any,
      source: query['source'] as any,
      limit: query['limit'] ? parseInt(query['limit'], 10) : undefined,
    };

    const records = await this.queryService.getVerifications(queryParams);
    return this.ok(request, records);
  }

  public async getTaskSummary(request: ApiRequest): Promise<ApiResponse> {
    if (!this.queryService) {
      throw ApiError.notImplemented('Verification query service not available');
    }

    const { taskId, workspaceId, repositoryId } = request.params;
    if (!taskId) {
      throw ApiError.badRequest('taskId parameter is required');
    }

    const summary = await this.queryService.getVerificationSummary(taskId, workspaceId, repositoryId);
    return this.ok(request, summary);
  }

  public async getTaskTimeline(request: ApiRequest): Promise<ApiResponse> {
    if (!this.queryService) {
      throw ApiError.notImplemented('Verification query service not available');
    }

    const { taskId } = request.params;
    if (!taskId) {
      throw ApiError.badRequest('taskId parameter is required');
    }

    const timeline = await this.queryService.getVerificationTimeline(taskId);
    return this.ok(request, timeline);
  }

  public async getCompletionEvidence(request: ApiRequest): Promise<ApiResponse> {
    if (!this.queryService) {
      throw ApiError.notImplemented('Verification query service not available');
    }

    const { taskId } = request.params;
    if (!taskId) {
      throw ApiError.badRequest('taskId parameter is required');
    }

    const evidence = await this.queryService.getCompletionEvidence(taskId);
    return this.ok(request, evidence);
  }

  public async getFeatureVerifications(request: ApiRequest): Promise<ApiResponse> {
    if (!this.queryService) {
      throw ApiError.notImplemented('Verification query service not available');
    }

    const { featureId } = request.params;
    if (!featureId) {
      throw ApiError.badRequest('featureId parameter is required');
    }

    const records = await this.queryService.getFeatureVerifications(featureId);
    return this.ok(request, records);
  }
}
