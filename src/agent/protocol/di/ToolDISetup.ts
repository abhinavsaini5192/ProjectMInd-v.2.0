import type { DIContainer } from '../../../workspace/di/DIContainer.js';
import type { IEventBus } from '../../../workspace/interfaces/IEventBus.js';
import type { IContextOrchestrator } from '../../../context/interfaces/IContextOrchestrator.js';
import type { IFeatureKnowledgeAPI } from '../../../knowledge/features/api/interfaces/IFeatureKnowledgeAPI.js';
import type { IAgentSessionManager } from '../../interfaces/IAgentSessionManager.js';
import type { IAgentCapabilityResolver } from '../../interfaces/IAgentCapabilityResolver.js';
import type { IAgentContextSessionManager } from '../../context/interfaces/IAgentContextSessionManager.js';
import { ToolTokens } from './ToolTokens.js';
import { createCanonicalToolRegistry } from '../registry/ToolManifest.js';
import { AgentToolRegistry } from '../registry/AgentToolRegistry.js';
import { ToolIdempotencyManager } from '../pipeline/ToolIdempotencyManager.js';
import { AgentToolPipeline } from '../pipeline/AgentToolPipeline.js';

// Canonical Tool Handlers
import { ProjectMindGetContextHandler } from '../handlers/ProjectMindGetContextHandler.js';
import { ProjectMindGetFeatureHandler } from '../handlers/ProjectMindGetFeatureHandler.js';
import { ProjectMindGetFeatureContextHandler } from '../handlers/ProjectMindGetFeatureContextHandler.js';
import { ProjectMindGetImpactHandler } from '../handlers/ProjectMindGetImpactHandler.js';
import { ProjectMindGetArchitectureHandler } from '../handlers/ProjectMindGetArchitectureHandler.js';
import { ProjectMindGetHistoryHandler } from '../handlers/ProjectMindGetHistoryHandler.js';
import { ProjectMindGetHealthHandler } from '../handlers/ProjectMindGetHealthHandler.js';
import { ProjectMindExplainContextHandler } from '../handlers/ProjectMindExplainContextHandler.js';
import { ProjectMindRefreshContextHandler } from '../handlers/ProjectMindRefreshContextHandler.js';
import { ProjectMindReportExecutionHandler } from '../handlers/ProjectMindReportExecutionHandler.js';
import { ProjectMindReportVerificationHandler } from '../handlers/ProjectMindReportVerificationHandler.js';
import { ProjectMindUpdateKnowledgeHandler } from '../handlers/ProjectMindUpdateKnowledgeHandler.js';

// Phase 7.4 Context Tool Handlers
import { ProjectMindStartTaskContextHandler } from '../../context/handlers/ProjectMindStartTaskContextHandler.js';
import { ProjectMindGetCurrentContextHandler } from '../../context/handlers/ProjectMindGetCurrentContextHandler.js';
import { ProjectMindRefreshTaskContextHandler } from '../../context/handlers/ProjectMindRefreshTaskContextHandler.js';
import { ProjectMindUpdateTaskContextHandler } from '../../context/handlers/ProjectMindUpdateTaskContextHandler.js';
import { ProjectMindPinContextHandler } from '../../context/handlers/ProjectMindPinContextHandler.js';
import { ProjectMindUnpinContextHandler } from '../../context/handlers/ProjectMindUnpinContextHandler.js';
import { ProjectMindReportContextFeedbackHandler } from '../../context/handlers/ProjectMindReportContextFeedbackHandler.js';

// Phase 7.5 Task Runtime Tool Handlers
import type { ITaskRuntime } from '../../runtime/interfaces/ITaskRuntime.js';
import { ProjectMindStartTaskHandler } from '../../runtime/handlers/ProjectMindStartTaskHandler.js';
import { ProjectMindGetTaskHandler } from '../../runtime/handlers/ProjectMindGetTaskHandler.js';
import { ProjectMindGetTaskStateHandler } from '../../runtime/handlers/ProjectMindGetTaskStateHandler.js';
import { ProjectMindGetTaskProgressHandler } from '../../runtime/handlers/ProjectMindGetTaskProgressHandler.js';
import { ProjectMindUpdateTaskHandler } from '../../runtime/handlers/ProjectMindUpdateTaskHandler.js';
import { ProjectMindCompleteTaskHandler } from '../../runtime/handlers/ProjectMindCompleteTaskHandler.js';
import { ProjectMindResumeTaskHandler } from '../../runtime/handlers/ProjectMindResumeTaskHandler.js';
import { ProjectMindCancelTaskHandler } from '../../runtime/handlers/ProjectMindCancelTaskHandler.js';

// Phase 7.6 Observation Tool Handlers
import type { IObservationProcessor } from '../../observation/interfaces/IObservationProcessor.js';
import type { IObservationQueryService } from '../../observation/interfaces/IObservationQueryService.js';
import { ProjectMindGetExecutionObservationsHandler } from '../../observation/handlers/ProjectMindGetExecutionObservationsHandler.js';
import { ProjectMindGetTaskTimelineHandler } from '../../observation/handlers/ProjectMindGetTaskTimelineHandler.js';
import { ProjectMindGetExecutionSummaryHandler } from '../../observation/handlers/ProjectMindGetExecutionSummaryHandler.js';
import { ProjectMindGetObservationConflictsHandler } from '../../observation/handlers/ProjectMindGetObservationConflictsHandler.js';

// Phase 7.7 Verification Tool Handlers
import type { IVerificationProcessor } from '../../../verification/interfaces/IVerificationProcessor.js';
import type { IVerificationQueryService } from '../../../verification/interfaces/IVerificationQueryService.js';
import { ProjectMindGetVerificationHandler } from '../../../verification/handlers/ProjectMindGetVerificationHandler.js';
import { ProjectMindGetVerificationSummaryHandler } from '../../../verification/handlers/ProjectMindGetVerificationSummaryHandler.js';
import { ProjectMindGetVerificationTimelineHandler } from '../../../verification/handlers/ProjectMindGetVerificationTimelineHandler.js';
import { ProjectMindGetCompletionEvidenceHandler } from '../../../verification/handlers/ProjectMindGetCompletionEvidenceHandler.js';
import { ProjectMindGetVerificationConflictsHandler } from '../../../verification/handlers/ProjectMindGetVerificationConflictsHandler.js';

// Phase 7.8 Knowledge Update Coordinator
import type { IKnowledgeUpdateCoordinator } from '../../../knowledge/update/interfaces/IKnowledgeUpdateCoordinator.js';

export interface ToolPipelineDependencies {
  readonly contextOrchestrator: IContextOrchestrator;
  readonly featureKnowledgeApi: IFeatureKnowledgeAPI;
  readonly eventBus?: IEventBus | undefined;
  readonly sessionManager?: IAgentSessionManager | undefined;
  readonly capabilityResolver?: IAgentCapabilityResolver | undefined;
  readonly idempotencyManager?: ToolIdempotencyManager | undefined;
  readonly contextSessionManager?: IAgentContextSessionManager | undefined;
  readonly taskRuntime?: ITaskRuntime | undefined;
  readonly observationProcessor?: IObservationProcessor | undefined;
  readonly observationQueryService?: IObservationQueryService | undefined;
  readonly verificationProcessor?: IVerificationProcessor | undefined;
  readonly verificationQueryService?: IVerificationQueryService | undefined;
  readonly knowledgeUpdateCoordinator?: IKnowledgeUpdateCoordinator | undefined;
}


export function createToolPipeline(deps: ToolPipelineDependencies): AgentToolPipeline {
  const registry = createCanonicalToolRegistry();
  const idempotencyManager = deps.idempotencyManager ?? new ToolIdempotencyManager();

  const pipeline = new AgentToolPipeline({
    registry,
    sessionManager: deps.sessionManager,
    capabilityResolver: deps.capabilityResolver,
    idempotencyManager,
  });

  // Register 12 canonical tool handlers
  pipeline.registerHandler(new ProjectMindGetContextHandler(deps.contextOrchestrator));
  pipeline.registerHandler(new ProjectMindGetFeatureHandler(deps.featureKnowledgeApi));
  pipeline.registerHandler(new ProjectMindGetFeatureContextHandler(deps.contextOrchestrator));
  pipeline.registerHandler(new ProjectMindGetImpactHandler(deps.featureKnowledgeApi));
  pipeline.registerHandler(new ProjectMindGetArchitectureHandler(deps.featureKnowledgeApi));
  pipeline.registerHandler(new ProjectMindGetHistoryHandler(deps.featureKnowledgeApi));
  pipeline.registerHandler(new ProjectMindGetHealthHandler(deps.featureKnowledgeApi));
  pipeline.registerHandler(new ProjectMindExplainContextHandler(deps.contextOrchestrator));
  pipeline.registerHandler(new ProjectMindRefreshContextHandler(deps.contextOrchestrator, deps.contextSessionManager));
  pipeline.registerHandler(
    new ProjectMindReportExecutionHandler(
      deps.eventBus,
      deps.contextSessionManager,
      deps.taskRuntime,
      deps.observationProcessor
    )
  );
  pipeline.registerHandler(
    new ProjectMindReportVerificationHandler(
      deps.eventBus,
      deps.taskRuntime,
      deps.observationProcessor,
      deps.verificationProcessor
    )
  );
  pipeline.registerHandler(new ProjectMindUpdateKnowledgeHandler(deps.eventBus, deps.knowledgeUpdateCoordinator));

  // Register Phase 7.4 Context Tool Handlers if contextSessionManager is provided
  if (deps.contextSessionManager) {
    pipeline.registerHandler(new ProjectMindStartTaskContextHandler(deps.contextSessionManager));
    pipeline.registerHandler(new ProjectMindGetCurrentContextHandler(deps.contextSessionManager));
    pipeline.registerHandler(new ProjectMindRefreshTaskContextHandler(deps.contextSessionManager));
    pipeline.registerHandler(new ProjectMindUpdateTaskContextHandler(deps.contextSessionManager));
    pipeline.registerHandler(new ProjectMindPinContextHandler(deps.contextSessionManager));
    pipeline.registerHandler(new ProjectMindUnpinContextHandler(deps.contextSessionManager));
    pipeline.registerHandler(new ProjectMindReportContextFeedbackHandler(deps.contextSessionManager));
  }

  // Register Phase 7.5 Task Runtime Tool Handlers if taskRuntime is provided
  if (deps.taskRuntime) {
    pipeline.registerHandler(new ProjectMindStartTaskHandler(deps.taskRuntime));
    pipeline.registerHandler(new ProjectMindGetTaskHandler(deps.taskRuntime));
    pipeline.registerHandler(new ProjectMindGetTaskStateHandler(deps.taskRuntime));
    pipeline.registerHandler(new ProjectMindGetTaskProgressHandler(deps.taskRuntime));
    pipeline.registerHandler(new ProjectMindUpdateTaskHandler(deps.taskRuntime));
    pipeline.registerHandler(new ProjectMindCompleteTaskHandler(deps.taskRuntime));
    pipeline.registerHandler(new ProjectMindResumeTaskHandler(deps.taskRuntime));
    pipeline.registerHandler(new ProjectMindCancelTaskHandler(deps.taskRuntime));
  }

  // Register Phase 7.6 Observation Tool Handlers if observationQueryService is provided
  if (deps.observationQueryService) {
    pipeline.registerHandler(new ProjectMindGetExecutionObservationsHandler(deps.observationQueryService));
    pipeline.registerHandler(new ProjectMindGetTaskTimelineHandler(deps.observationQueryService));
    pipeline.registerHandler(new ProjectMindGetExecutionSummaryHandler(deps.observationQueryService));
    pipeline.registerHandler(new ProjectMindGetObservationConflictsHandler(deps.observationQueryService));
  }

  // Register Phase 7.7 Verification Tool Handlers if verificationQueryService is provided
  if (deps.verificationQueryService) {
    pipeline.registerHandler(new ProjectMindGetVerificationHandler(deps.verificationQueryService));
    pipeline.registerHandler(new ProjectMindGetVerificationSummaryHandler(deps.verificationQueryService));
    pipeline.registerHandler(new ProjectMindGetVerificationTimelineHandler(deps.verificationQueryService));
    pipeline.registerHandler(new ProjectMindGetCompletionEvidenceHandler(deps.verificationQueryService));
    pipeline.registerHandler(new ProjectMindGetVerificationConflictsHandler(deps.verificationQueryService));
  }

  return pipeline;
}


export class ToolDISetup {
  public static register(container: DIContainer, deps: ToolPipelineDependencies): void {
    const registry = createCanonicalToolRegistry();
    const idempotencyManager = deps.idempotencyManager ?? new ToolIdempotencyManager();

    container.registerFactory(ToolTokens.IAgentToolRegistry, () => registry, 'Singleton');
    container.registerFactory(ToolTokens.ToolIdempotencyManager, () => idempotencyManager, 'Singleton');

    // Handlers
    container.registerFactory(
      ToolTokens.ProjectMindGetContextHandler,
      () => new ProjectMindGetContextHandler(deps.contextOrchestrator),
      'Singleton'
    );
    container.registerFactory(
      ToolTokens.ProjectMindGetFeatureHandler,
      () => new ProjectMindGetFeatureHandler(deps.featureKnowledgeApi),
      'Singleton'
    );
    container.registerFactory(
      ToolTokens.ProjectMindGetFeatureContextHandler,
      () => new ProjectMindGetFeatureContextHandler(deps.contextOrchestrator),
      'Singleton'
    );
    container.registerFactory(
      ToolTokens.ProjectMindGetImpactHandler,
      () => new ProjectMindGetImpactHandler(deps.featureKnowledgeApi),
      'Singleton'
    );
    container.registerFactory(
      ToolTokens.ProjectMindGetArchitectureHandler,
      () => new ProjectMindGetArchitectureHandler(deps.featureKnowledgeApi),
      'Singleton'
    );
    container.registerFactory(
      ToolTokens.ProjectMindGetHistoryHandler,
      () => new ProjectMindGetHistoryHandler(deps.featureKnowledgeApi),
      'Singleton'
    );
    container.registerFactory(
      ToolTokens.ProjectMindGetHealthHandler,
      () => new ProjectMindGetHealthHandler(deps.featureKnowledgeApi),
      'Singleton'
    );
    container.registerFactory(
      ToolTokens.ProjectMindExplainContextHandler,
      () => new ProjectMindExplainContextHandler(deps.contextOrchestrator),
      'Singleton'
    );
    container.registerFactory(
      ToolTokens.ProjectMindRefreshContextHandler,
      () => new ProjectMindRefreshContextHandler(deps.contextOrchestrator, deps.contextSessionManager),
      'Singleton'
    );
    container.registerFactory(
      ToolTokens.ProjectMindReportExecutionHandler,
      () =>
        new ProjectMindReportExecutionHandler(
          deps.eventBus,
          deps.contextSessionManager,
          deps.taskRuntime,
          deps.observationProcessor
        ),
      'Singleton'
    );
    container.registerFactory(
      ToolTokens.ProjectMindReportVerificationHandler,
      () =>
        new ProjectMindReportVerificationHandler(
          deps.eventBus,
          deps.taskRuntime,
          deps.observationProcessor,
          deps.verificationProcessor
        ),
      'Singleton'
    );

    container.registerFactory(
      ToolTokens.ProjectMindUpdateKnowledgeHandler,
      () => new ProjectMindUpdateKnowledgeHandler(deps.eventBus, deps.knowledgeUpdateCoordinator),
      'Singleton'
    );

    // Phase 7.4 Context Tool Handlers
    if (deps.contextSessionManager) {
      container.registerFactory(
        ToolTokens.ProjectMindStartTaskContextHandler,
        () => new ProjectMindStartTaskContextHandler(deps.contextSessionManager!),
        'Singleton'
      );
      container.registerFactory(
        ToolTokens.ProjectMindGetCurrentContextHandler,
        () => new ProjectMindGetCurrentContextHandler(deps.contextSessionManager!),
        'Singleton'
      );
      container.registerFactory(
        ToolTokens.ProjectMindRefreshTaskContextHandler,
        () => new ProjectMindRefreshTaskContextHandler(deps.contextSessionManager!),
        'Singleton'
      );
      container.registerFactory(
        ToolTokens.ProjectMindUpdateTaskContextHandler,
        () => new ProjectMindUpdateTaskContextHandler(deps.contextSessionManager!),
        'Singleton'
      );
      container.registerFactory(
        ToolTokens.ProjectMindPinContextHandler,
        () => new ProjectMindPinContextHandler(deps.contextSessionManager!),
        'Singleton'
      );
      container.registerFactory(
        ToolTokens.ProjectMindUnpinContextHandler,
        () => new ProjectMindUnpinContextHandler(deps.contextSessionManager!),
        'Singleton'
      );
      container.registerFactory(
        ToolTokens.ProjectMindReportContextFeedbackHandler,
        () => new ProjectMindReportContextFeedbackHandler(deps.contextSessionManager!),
        'Singleton'
      );
    }

    // Phase 7.5 Task Runtime Tool Handlers
    if (deps.taskRuntime) {
      container.registerFactory(
        ToolTokens.ProjectMindStartTaskHandler,
        () => new ProjectMindStartTaskHandler(deps.taskRuntime!),
        'Singleton'
      );
      container.registerFactory(
        ToolTokens.ProjectMindGetTaskHandler,
        () => new ProjectMindGetTaskHandler(deps.taskRuntime!),
        'Singleton'
      );
      container.registerFactory(
        ToolTokens.ProjectMindGetTaskStateHandler,
        () => new ProjectMindGetTaskStateHandler(deps.taskRuntime!),
        'Singleton'
      );
      container.registerFactory(
        ToolTokens.ProjectMindGetTaskProgressHandler,
        () => new ProjectMindGetTaskProgressHandler(deps.taskRuntime!),
        'Singleton'
      );
      container.registerFactory(
        ToolTokens.ProjectMindUpdateTaskHandler,
        () => new ProjectMindUpdateTaskHandler(deps.taskRuntime!),
        'Singleton'
      );
      container.registerFactory(
        ToolTokens.ProjectMindCompleteTaskHandler,
        () => new ProjectMindCompleteTaskHandler(deps.taskRuntime!),
        'Singleton'
      );
      container.registerFactory(
        ToolTokens.ProjectMindResumeTaskHandler,
        () => new ProjectMindResumeTaskHandler(deps.taskRuntime!),
        'Singleton'
      );
      container.registerFactory(
        ToolTokens.ProjectMindCancelTaskHandler,
        () => new ProjectMindCancelTaskHandler(deps.taskRuntime!),
        'Singleton'
      );
    }

    // Phase 7.6 Observation Tool Handlers
    if (deps.observationQueryService) {
      container.registerFactory(
        ToolTokens.ProjectMindGetExecutionObservationsHandler,
        () => new ProjectMindGetExecutionObservationsHandler(deps.observationQueryService!),
        'Singleton'
      );
      container.registerFactory(
        ToolTokens.ProjectMindGetTaskTimelineHandler,
        () => new ProjectMindGetTaskTimelineHandler(deps.observationQueryService!),
        'Singleton'
      );
      container.registerFactory(
        ToolTokens.ProjectMindGetExecutionSummaryHandler,
        () => new ProjectMindGetExecutionSummaryHandler(deps.observationQueryService!),
        'Singleton'
      );
      container.registerFactory(
        ToolTokens.ProjectMindGetObservationConflictsHandler,
        () => new ProjectMindGetObservationConflictsHandler(deps.observationQueryService!),
        'Singleton'
      );
    }

    // Phase 7.7 Verification Tool Handlers
    if (deps.verificationQueryService) {
      container.registerFactory(
        ToolTokens.ProjectMindGetVerificationHandler,
        () => new ProjectMindGetVerificationHandler(deps.verificationQueryService!),
        'Singleton'
      );
      container.registerFactory(
        ToolTokens.ProjectMindGetVerificationSummaryHandler,
        () => new ProjectMindGetVerificationSummaryHandler(deps.verificationQueryService!),
        'Singleton'
      );
      container.registerFactory(
        ToolTokens.ProjectMindGetVerificationTimelineHandler,
        () => new ProjectMindGetVerificationTimelineHandler(deps.verificationQueryService!),
        'Singleton'
      );
      container.registerFactory(
        ToolTokens.ProjectMindGetCompletionEvidenceHandler,
        () => new ProjectMindGetCompletionEvidenceHandler(deps.verificationQueryService!),
        'Singleton'
      );
      container.registerFactory(
        ToolTokens.ProjectMindGetVerificationConflictsHandler,
        () => new ProjectMindGetVerificationConflictsHandler(deps.verificationQueryService!),
        'Singleton'
      );
    }

    // Pipeline
    container.registerFactory(
      ToolTokens.IAgentToolPipeline,
      () => createToolPipeline(deps),
      'Singleton'
    );

  }
}
