import { describe, it, expect, beforeEach } from 'vitest';
import { ApiRouter } from '../../src/api/routing/ApiRouter.js';
import { RequestService } from '../../src/api/services/RequestService.js';
import { HealthController } from '../../src/api/controllers/HealthController.js';
import { ContextController } from '../../src/api/controllers/ContextController.js';
import { FeatureController } from '../../src/api/controllers/FeatureController.js';
import { KnowledgeUpdateController } from '../../src/api/controllers/KnowledgeUpdateController.js';
import { AgentRuntimeController } from '../../src/api/controllers/AgentRuntimeController.js';
import { VerificationController } from '../../src/api/controllers/VerificationController.js';
import { PlatformHealthService } from '../../src/platform/health/PlatformHealthService.js';
import type { IContextOrchestrator } from '../../src/context/interfaces/IContextOrchestrator.js';
import type { IFeatureKnowledgeAPI } from '../../src/knowledge/features/api/interfaces/IFeatureKnowledgeAPI.js';
import type { IKnowledgeUpdateCoordinator } from '../../src/knowledge/update/interfaces/IKnowledgeUpdateCoordinator.js';
import type { IProductionAgentRuntime } from '../../src/agent/runtime/interfaces/IProductionAgentRuntime.js';
import type { IVerificationProcessor } from '../../src/verification/interfaces/IVerificationProcessor.js';
import type { IVerificationQueryService } from '../../src/verification/interfaces/IVerificationQueryService.js';

describe('Domain Controllers Integration', () => {
  let router: ApiRouter;
  let requestService: RequestService;

  beforeEach(() => {
    router = new ApiRouter();
    requestService = new RequestService();
  });

  describe('HealthController', () => {
    it('integrates with PlatformHealthService and returns health, liveness, and readiness reports', async () => {
      const healthService = new PlatformHealthService('1.0.0', 'test');
      healthService.registerComponent('database', async () => ({
        status: 'HEALTHY',
        message: 'Connected',
      }));

      const ctrl = new HealthController(healthService);
      ctrl.registerRoutes(router);

      // 1. Health report
      const healthReq = requestService.createRequest({ path: '/v1/health', method: 'GET' });
      const healthRes = await router.handle(healthReq);
      expect(healthRes.status).toBe(200);
      expect((healthRes.data as any).status).toBe('HEALTHY');
      expect((healthRes.data as any).components['database']).toBeDefined();

      // 2. Liveness
      const liveReq = requestService.createRequest({ path: '/health/live', method: 'GET' });
      const liveRes = await router.handle(liveReq);
      expect(liveRes.status).toBe(200);
      expect((liveRes.data as any).status).toBe('alive');

      // 3. Readiness
      const readyReq = requestService.createRequest({ path: '/health/ready', method: 'GET' });
      const readyRes = await router.handle(readyReq);
      expect(readyRes.status).toBe(200);
      expect((readyRes.data as any).ready).toBe(true);
    });
  });

  describe('ContextController', () => {
    it('delegates orchestration, planning, packaging, and token estimation to canonical IContextOrchestrator', async () => {
      let validateCalled = false;
      let orchestrateCalled = false;

      const mockOrchestrator: IContextOrchestrator = {
        validateContextRequest: () => {
          validateCalled = true;
        },
        orchestrateContext: async (req) => {
          orchestrateCalled = true;
          return {
            contextPackage: { id: 'pkg-1', sections: [] },
            tokenCount: 1200,
            durationMs: 45,
          } as any;
        },
        getContextPlan: async () => ({ planId: 'plan-1', steps: [] } as any),
        getContextPackage: async () => ({ id: 'pkg-1', items: [] } as any),
        getFeatureContextForTask: async () => ({ featureContext: true } as any),
        getContextExplanation: async () => ({ summary: 'Context explanation' } as any),
        estimateContextTokens: async () => 850,
      };

      const ctrl = new ContextController(mockOrchestrator);
      ctrl.registerRoutes(router);

      // Orchestrate endpoint
      const req = requestService.createRequest({
        path: '/v1/workspaces/ws-1/repositories/repo-1/context/orchestrate',
        method: 'POST',
        body: { query: 'Fix authentication flaw', featureId: 'feat-auth' },
      });

      const res = await router.handle(req);
      expect(res.status).toBe(200);
      expect(validateCalled).toBe(true);
      expect(orchestrateCalled).toBe(true);
      expect((res.data as any).tokenCount).toBe(1200);

      // Estimate tokens endpoint
      const estReq = requestService.createRequest({
        path: '/v1/workspaces/ws-1/repositories/repo-1/context/estimate',
        method: 'POST',
        body: { query: 'Estimate test' },
      });
      const estRes = await router.handle(estReq);
      expect(estRes.status).toBe(200);
      expect((estRes.data as any).estimatedTokens).toBe(850);
    });
  });

  describe('FeatureController', () => {
    it('delegates feature knowledge retrieval to canonical IFeatureKnowledgeAPI read facade', async () => {
      let requestedFeatureId = '';

      const mockFeatureApi: Partial<IFeatureKnowledgeAPI> = {
        getFeatureKnowledge: async (q: any) => ({
          featureId: typeof q === 'string' ? q : q.featureId,
          sections: {},
        } as any),
        getFeatureProfile: async (id: string) => {
          requestedFeatureId = id;
          return {
            featureId: id,
            name: 'Authentication Module',
            status: 'ACTIVE',
          } as any;
        },
        getFeatureSummary: async (id: string) => ({
          featureId: id,
          title: 'Auth Summary',
          summary: 'Handles user logins',
        } as any),
        getFeatureDependencies: async (id: string) => ({
          featureId: id,
          dependencies: ['user_store', 'crypto'],
        } as any),
        getFeatureImpact: async (id: string) => ({
          featureId: id,
          impactScore: 0.85,
        } as any),
      };

      const ctrl = new FeatureController(mockFeatureApi as IFeatureKnowledgeAPI);
      ctrl.registerRoutes(router);

      // 1. Get feature profile
      const req = requestService.createRequest({
        path: '/v1/workspaces/ws-1/repositories/repo-1/features/feat-auth',
        method: 'GET',
      });
      const res = await router.handle(req);
      expect(res.status).toBe(200);
      expect(requestedFeatureId).toBe('feat-auth');
      expect((res.data as any).name).toBe('Authentication Module');

      // 2. Get dependencies
      const depReq = requestService.createRequest({
        path: '/v1/workspaces/ws-1/repositories/repo-1/features/feat-auth/dependencies',
        method: 'GET',
      });
      const depRes = await router.handle(depReq);
      expect(depRes.status).toBe(200);
      expect((depRes.data as any).dependencies).toContain('crypto');

      // 3. Get impact
      const impReq = requestService.createRequest({
        path: '/v1/workspaces/ws-1/repositories/repo-1/features/feat-auth/impact',
        method: 'GET',
      });
      const impRes = await router.handle(impReq);
      expect(impRes.status).toBe(200);
      expect((impRes.data as any).impactScore).toBe(0.85);
    });
  });

  describe('KnowledgeUpdateController', () => {
    it('delegates mutation requests to canonical IKnowledgeUpdateCoordinator and preserves provenance', async () => {
      let capturedParams: any = null;

      const mockCoordinator: Partial<IKnowledgeUpdateCoordinator> = {
        processKnowledgeUpdate: async (params) => {
          capturedParams = params;
          return {
            updateId: 'upd-999',
            status: 'APPLIED',
            appliedChangesCount: 3,
          } as any;
        },
        getKnowledgeUpdate: async (id) => ({
          updateId: id,
          status: 'APPLIED',
          repositoryId: 'repo-1',
        } as any),
        getKnowledgeVersion: async (repoId) => ({
          version: '1.4.2',
          repositoryId: repoId,
          lastUpdatedAt: Date.now(),
        } as any),
        retryKnowledgeUpdate: async (id) => ({
          updateId: id,
          status: 'APPLIED',
        } as any),
      };

      const ctrl = new KnowledgeUpdateController(mockCoordinator as IKnowledgeUpdateCoordinator);
      ctrl.registerRoutes(router);

      // Process update
      const req = requestService.createRequest({
        path: '/v1/workspaces/ws-1/repositories/repo-1/knowledge-updates',
        method: 'POST',
        body: {
          source: 'AGENT_OBSERVATION',
          updateType: 'RESOURCE_MODIFIED',
          affectedResources: ['src/auth/jwt.ts'],
          confidence: 0.95,
        },
      });

      const res = await router.handle(req);
      expect(res.status).toBe(201);
      expect((res.data as any).updateId).toBe('upd-999');
      expect(capturedParams.workspaceId).toBe('ws-1');
      expect(capturedParams.repositoryId).toBe('repo-1');
      expect(capturedParams.affectedResources).toContain('src/auth/jwt.ts');
      expect(res.headers?.['location']).toContain('upd-999');

      // Version endpoint
      const verReq = requestService.createRequest({
        path: '/v1/workspaces/ws-1/repositories/repo-1/knowledge-updates/version',
        method: 'GET',
      });
      const verRes = await router.handle(verReq);
      expect(verRes.status).toBe(200);
      expect((verRes.data as any).version).toBe('1.4.2');
    });
  });

  describe('AgentRuntimeController', () => {
    it('coordinates agent sessions, task submission, and tool executions with IProductionAgentRuntime', async () => {
      let createdSessionParams: any = null;

      const mockRuntime: Partial<IProductionAgentRuntime> = {
        getStatus: async () => ({ state: 'RUNNING', activeSessions: 1, activeTasks: 0 } as any),
        getHealth: async () => ({ status: 'HEALTHY', components: {} } as any),
        getMetrics: () => ({ sessionsTotal: 5, tasksTotal: 10 } as any),
        getCapabilities: () => ({ supportedTools: ['read_file', 'write_file'] } as any),
        createSession: async (params) => {
          createdSessionParams = params;
          return {
            sessionId: 'sess-agent-123',
            agentId: params.agentId,
            workspaceId: params.workspaceId,
            repositoryId: params.repositoryId,
            status: 'ACTIVE',
            createdAt: new Date().toISOString(),
          } as any;
        },
        getSession: async (id) => ({
          sessionId: id,
          agentId: 'agent-42',
          workspaceId: 'ws-1',
          repositoryId: 'repo-1',
          status: 'ACTIVE',
        } as any),
        submitTask: async (taskParams) => ({
          task: {
            taskId: 'task-777',
            title: taskParams.title,
            status: 'CREATED',
          },
        } as any),
        executeTool: async (toolReq) => ({
          requestId: toolReq.requestId,
          toolName: toolReq.toolName,
          status: 'SUCCESS',
          output: { content: 'File contents read successfully' },
        } as any),
      };

      const ctrl = new AgentRuntimeController(mockRuntime as IProductionAgentRuntime);
      ctrl.registerRoutes(router);

      // 1. Create session
      const sessReq = requestService.createRequest({
        path: '/v1/runtime/sessions',
        method: 'POST',
        body: {
          agentId: 'coder-bot',
          workspaceId: 'ws-1',
          repositoryId: 'repo-1',
        },
      });
      const sessRes = await router.handle(sessReq);
      expect(sessRes.status).toBe(201);
      expect((sessRes.data as any).sessionId).toBe('sess-agent-123');
      expect(createdSessionParams.agentId).toBe('coder-bot');

      // 2. Submit task
      const taskReq = requestService.createRequest({
        path: '/v1/runtime/sessions/sess-agent-123/tasks',
        method: 'POST',
        body: {
          title: 'Refactor UserService',
          description: 'Extract JWT helper',
        },
      });
      const taskRes = await router.handle(taskReq);
      expect(taskRes.status).toBe(201);
      expect((taskRes.data as any).task.taskId).toBe('task-777');

      // 3. Execute tool
      const toolReq = requestService.createRequest({
        path: '/v1/runtime/sessions/sess-agent-123/tasks/task-777/execute',
        method: 'POST',
        body: {
          toolName: 'read_file',
          arguments: { path: 'src/index.ts' },
        },
      });
      const toolRes = await router.handle(toolReq);
      expect(toolRes.status).toBe(200);
      expect((toolRes.data as any).status).toBe('SUCCESS');
      expect((toolRes.data as any).output.content).toContain('File contents');
    });
  });

  describe('VerificationController', () => {
    it('delegates verification intake and queries to canonical verification processor and query service', async () => {
      let receivedInput: any = null;

      const mockProcessor: IVerificationProcessor = {
        processVerification: async (input) => {
          receivedInput = input;
          return {
            record: {
              verificationId: 'verif-record-456',
              status: 'PASSED',
              workspaceId: input.workspaceId,
              repositoryId: input.repositoryId,
            } as any,
            processed: true,
            isDuplicate: false,
            conflicts: [],
            freshness: 'FRESH' as any,
          };
        },
      };

      const mockQueryService: Partial<IVerificationQueryService> = {
        getVerification: async (id) => ({
          verificationId: id,
          status: 'PASSED',
          summary: 'All 24 tests passed',
        } as any),
        getVerificationSummary: async (taskId) => ({
          taskId,
          totalVerifications: 1,
          passed: 1,
          failed: 0,
        } as any),
        getCompletionEvidence: async (taskId) => ({
          taskId,
          verified: true,
          confidence: 'HIGH',
        } as any),
      };

      const ctrl = new VerificationController(mockProcessor, mockQueryService as IVerificationQueryService);
      ctrl.registerRoutes(router);

      // Process verification
      const procReq = requestService.createRequest({
        path: '/v1/workspaces/ws-1/repositories/repo-1/verification/process',
        method: 'POST',
        body: {
          taskId: 'task-777',
          verificationType: 'TEST_EXECUTION',
          status: 'PASSED',
          rawOutput: 'PASS: 24 tests passed',
          passed: true,
        },
      });

      const procRes = await router.handle(procReq);
      expect(procRes.status).toBe(201);
      expect((procRes.data as any).record.verificationId).toBe('verif-record-456');
      expect(receivedInput.taskId).toBe('task-777');
      expect(receivedInput.passed).toBe(true);

      // Query completion evidence
      const evidReq = requestService.createRequest({
        path: '/v1/workspaces/ws-1/repositories/repo-1/verification/tasks/task-777/completion-evidence',
        method: 'GET',
      });
      const evidRes = await router.handle(evidReq);
      expect(evidRes.status).toBe(200);
      expect((evidRes.data as any).verified).toBe(true);
      expect((evidRes.data as any).confidence).toBe('HIGH');
    });
  });
});
