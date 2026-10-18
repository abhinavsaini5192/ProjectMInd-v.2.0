import type { DIContainer } from '../../workspace/di/DIContainer.js';
import { ApiTokens } from './ApiTokens.js';
import { ApiRouter } from '../routing/ApiRouter.js';
import { ApiService } from '../services/ApiService.js';
import { HttpAdapter } from '../adapters/HttpAdapter.js';
import { InMemoryIdempotencyStore } from '../idempotency/InMemoryIdempotencyStore.js';
import { IdempotencyService } from '../idempotency/IdempotencyService.js';
import { InMemoryRateLimiter } from '../ratelimit/InMemoryRateLimiter.js';
import { HealthController } from '../controllers/HealthController.js';
import { CapabilitiesController } from '../controllers/CapabilitiesController.js';
import { WorkspaceController } from '../controllers/WorkspaceController.js';
import { ProjectController } from '../controllers/ProjectController.js';
import { RepositoryController } from '../controllers/RepositoryController.js';
import { ContextController } from '../controllers/ContextController.js';
import { FeatureController } from '../controllers/FeatureController.js';
import { KnowledgeUpdateController } from '../controllers/KnowledgeUpdateController.js';
import { AgentRuntimeController } from '../controllers/AgentRuntimeController.js';
import { VerificationController } from '../controllers/VerificationController.js';
import { CollaborationController } from '../controllers/CollaborationController.js';
import type { ICollaborationManager } from '../../agent/collaboration/interfaces/ICollaborationManager.js';
import { PlanController } from '../controllers/PlanController.js';
import type { ITaskPlannerService } from '../../agent/planning/interfaces/ITaskPlanner.js';
import { LearningController } from '../controllers/LearningController.js';
import type { ILearningIntelligenceService } from '../../intelligence/learning/interfaces/ILearningIntelligenceService.js';
import { PluginController } from '../controllers/PluginController.js';
import type { IPluginService } from '../../plugins/interfaces/IPluginService.js';
import { AnalyticsController } from '../controllers/AnalyticsController.js';
import type { IAnalyticsService } from '../../analytics/interfaces/IAnalyticsService.js';

import type { PlatformHealthService } from '../../platform/health/PlatformHealthService.js';
import type { IContextOrchestrator } from '../../context/interfaces/IContextOrchestrator.js';
import type { IAgentContextSessionManager } from '../../agent/context/interfaces/IAgentContextSessionManager.js';
import type { IFeatureKnowledgeAPI } from '../../knowledge/features/api/interfaces/IFeatureKnowledgeAPI.js';
import type { IKnowledgeUpdateCoordinator } from '../../knowledge/update/interfaces/IKnowledgeUpdateCoordinator.js';
import type { IProductionAgentRuntime } from '../../agent/runtime/interfaces/IProductionAgentRuntime.js';
import type { IVerificationProcessor } from '../../verification/interfaces/IVerificationProcessor.js';
import type { IVerificationQueryService } from '../../verification/interfaces/IVerificationQueryService.js';

export interface ApiSetupOptions {
  readonly healthService?: PlatformHealthService | undefined;
  readonly contextOrchestrator?: IContextOrchestrator | undefined;
  readonly sessionManager?: IAgentContextSessionManager | undefined;
  readonly featureApi?: IFeatureKnowledgeAPI | undefined;
  readonly updateCoordinator?: IKnowledgeUpdateCoordinator | undefined;
  readonly agentRuntime?: IProductionAgentRuntime | undefined;
  readonly verificationProcessor?: IVerificationProcessor | undefined;
  readonly verificationQueryService?: IVerificationQueryService | undefined;
  readonly collaborationManager?: ICollaborationManager | undefined;
  readonly plannerService?: ITaskPlannerService | undefined;
  readonly learningService?: ILearningIntelligenceService | undefined;
  readonly pluginService?: IPluginService | undefined;
  readonly analyticsService?: IAnalyticsService | undefined;
}

export class ApiDISetup {
  public static register(container: DIContainer, options?: ApiSetupOptions | undefined): void {
    // 1. Idempotency & Rate Limiting
    const idempotencyStore = new InMemoryIdempotencyStore();
    const idempotencyService = new IdempotencyService(idempotencyStore);
    const rateLimiter = new InMemoryRateLimiter();

    container.registerInstance(ApiTokens.IIdempotencyStore, idempotencyStore);
    container.registerInstance(ApiTokens.IIdempotencyService, idempotencyService);
    container.registerInstance(ApiTokens.IRateLimiter, rateLimiter);

    // 2. Router
    const router = new ApiRouter();
    container.registerInstance(ApiTokens.IApiRouter, router);

    // 3. Controllers
    if (options?.healthService) {
      const healthCtrl = new HealthController(options.healthService);
      healthCtrl.registerRoutes(router);
      container.registerInstance(ApiTokens.HealthController, healthCtrl);
    }

    const capabilitiesCtrl = new CapabilitiesController(router);
    capabilitiesCtrl.registerRoutes(router);
    container.registerInstance(ApiTokens.CapabilitiesController, capabilitiesCtrl);

    const workspaceCtrl = new WorkspaceController();
    workspaceCtrl.registerRoutes(router);
    container.registerInstance(ApiTokens.WorkspaceController, workspaceCtrl);

    const projectCtrl = new ProjectController();
    projectCtrl.registerRoutes(router);
    container.registerInstance(ApiTokens.ProjectController, projectCtrl);

    const repositoryCtrl = new RepositoryController();
    repositoryCtrl.registerRoutes(router);
    container.registerInstance(ApiTokens.RepositoryController, repositoryCtrl);

    if (options?.contextOrchestrator) {
      const contextCtrl = new ContextController(options.contextOrchestrator, options.sessionManager);
      contextCtrl.registerRoutes(router);
      container.registerInstance(ApiTokens.ContextController, contextCtrl);
    }

    if (options?.featureApi) {
      const featureCtrl = new FeatureController(options.featureApi);
      featureCtrl.registerRoutes(router);
      container.registerInstance(ApiTokens.FeatureController, featureCtrl);
    }

    if (options?.updateCoordinator) {
      const updateCtrl = new KnowledgeUpdateController(options.updateCoordinator);
      updateCtrl.registerRoutes(router);
      container.registerInstance(ApiTokens.KnowledgeUpdateController, updateCtrl);
    }

    if (options?.agentRuntime) {
      const agentCtrl = new AgentRuntimeController(options.agentRuntime);
      agentCtrl.registerRoutes(router);
      container.registerInstance(ApiTokens.AgentRuntimeController, agentCtrl);
    }

    if (options?.verificationProcessor) {
      const verifCtrl = new VerificationController(options.verificationProcessor, options.verificationQueryService);
      verifCtrl.registerRoutes(router);
      container.registerInstance(ApiTokens.VerificationController, verifCtrl);
    }

    if (options?.collaborationManager) {
      const collabCtrl = new CollaborationController(options.collaborationManager);
      collabCtrl.registerRoutes(router);
      container.registerInstance(ApiTokens.CollaborationController, collabCtrl);
    }

    if (options?.plannerService) {
      const planCtrl = new PlanController(options.plannerService);
      planCtrl.registerRoutes(router);
      container.registerInstance(ApiTokens.PlanController, planCtrl);
    }

    if (options?.learningService) {
      const learningCtrl = new LearningController(options.learningService);
      learningCtrl.registerRoutes(router);
      container.registerInstance(ApiTokens.LearningController, learningCtrl);
    }

    if (options?.pluginService) {
      const pluginCtrl = new PluginController(options.pluginService);
      pluginCtrl.registerRoutes(router);
      container.registerInstance(ApiTokens.PluginController, pluginCtrl);
    }

    if (options?.analyticsService) {
      const analyticsCtrl = new AnalyticsController(options.analyticsService);
      analyticsCtrl.registerRoutes(router);
      container.registerInstance(ApiTokens.AnalyticsController, analyticsCtrl);
    }

    // 4. API Service & HTTP Adapter
    const apiService = new ApiService({ router });
    const httpAdapter = new HttpAdapter(apiService);

    container.registerInstance(ApiTokens.IApiService, apiService);
    container.registerInstance(ApiTokens.HttpAdapter, httpAdapter);
  }
}
