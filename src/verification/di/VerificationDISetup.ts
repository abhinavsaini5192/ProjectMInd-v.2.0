import { DIContainer } from '../../workspace/di/DIContainer.js';
import { VerificationTokens } from './VerificationTokens.js';
import { InMemoryVerificationStore } from '../services/InMemoryVerificationStore.js';
import { VerificationSourceTrustRegistry } from '../services/VerificationSourceTrustRegistry.js';
import { VerificationValidator } from '../services/VerificationValidator.js';
import { VerificationNormalizer } from '../services/VerificationNormalizer.js';
import { VerificationCorrelator } from '../services/VerificationCorrelator.js';
import { VerificationConflictResolver } from '../services/VerificationConflictResolver.js';
import { VerificationFreshnessEvaluator } from '../services/VerificationFreshnessEvaluator.js';
import { VerificationProcessor } from '../services/VerificationProcessor.js';
import { VerificationQueryService } from '../services/VerificationQueryService.js';
import { ProjectMindGetVerificationHandler } from '../handlers/ProjectMindGetVerificationHandler.js';
import { ProjectMindGetVerificationSummaryHandler } from '../handlers/ProjectMindGetVerificationSummaryHandler.js';
import { ProjectMindGetVerificationTimelineHandler } from '../handlers/ProjectMindGetVerificationTimelineHandler.js';
import { ProjectMindGetCompletionEvidenceHandler } from '../handlers/ProjectMindGetCompletionEvidenceHandler.js';
import { ProjectMindGetVerificationConflictsHandler } from '../handlers/ProjectMindGetVerificationConflictsHandler.js';
import { TaskRuntimeTokens } from '../../agent/runtime/di/TaskRuntimeTokens.js';
import { AgentContextTokens } from '../../agent/context/di/AgentContextTokens.js';
import { ObservationTokens } from '../../agent/observation/di/ObservationTokens.js';

export function registerVerificationServices(container: DIContainer): void {
  // Store
  container.registerSingleton(
    VerificationTokens.IVerificationStore,
    () => new InMemoryVerificationStore()
  );

  // Trust Registry
  container.registerSingleton(
    VerificationTokens.IVerificationSourceTrustRegistry,
    () => new VerificationSourceTrustRegistry()
  );

  // Validator & Normalizer
  container.registerSingleton(
    VerificationTokens.IVerificationValidator,
    () => new VerificationValidator()
  );
  container.registerSingleton(
    VerificationTokens.IVerificationNormalizer,
    () =>
      new VerificationNormalizer(
        container.resolve(VerificationTokens.IVerificationSourceTrustRegistry)
      )
  );

  // Correlator, ConflictResolver, FreshnessEvaluator
  container.registerSingleton(
    VerificationTokens.IVerificationCorrelator,
    () => new VerificationCorrelator()
  );
  container.registerSingleton(
    VerificationTokens.IVerificationConflictResolver,
    () => new VerificationConflictResolver()
  );
  container.registerSingleton(
    VerificationTokens.IVerificationFreshnessEvaluator,
    () => new VerificationFreshnessEvaluator()
  );

  // Processor
  container.registerSingleton(
    VerificationTokens.IVerificationProcessor,
    () =>
      new VerificationProcessor({
        store: container.resolve(VerificationTokens.IVerificationStore),
        normalizer: container.resolve(VerificationTokens.IVerificationNormalizer),
        validator: container.resolve(VerificationTokens.IVerificationValidator),
        correlator: container.resolve(VerificationTokens.IVerificationCorrelator),
        conflictResolver: container.resolve(VerificationTokens.IVerificationConflictResolver),
        freshnessEvaluator: container.resolve(VerificationTokens.IVerificationFreshnessEvaluator),
        eventBus: container.hasRegistration(Symbol.for('IEventBus'))
          ? container.resolve(Symbol.for('IEventBus'))
          : undefined,
        taskRuntime: container.hasRegistration(TaskRuntimeTokens.ITaskRuntime)
          ? container.resolve(TaskRuntimeTokens.ITaskRuntime)
          : undefined,
        observationProcessor: container.hasRegistration(ObservationTokens.IObservationProcessor)
          ? container.resolve(ObservationTokens.IObservationProcessor)
          : undefined,
        contextSessionManager: container.hasRegistration(AgentContextTokens.IAgentContextSessionManager)
          ? container.resolve(AgentContextTokens.IAgentContextSessionManager)
          : undefined,
      })
  );

  // Query Service
  container.registerSingleton(
    VerificationTokens.IVerificationQueryService,
    () =>
      new VerificationQueryService(
        container.resolve(VerificationTokens.IVerificationStore),
        container.resolve(VerificationTokens.IVerificationFreshnessEvaluator)
      )
  );

  // Handlers
  container.registerSingleton(
    VerificationTokens.ProjectMindGetVerificationHandler,
    () =>
      new ProjectMindGetVerificationHandler(
        container.resolve(VerificationTokens.IVerificationQueryService)
      )
  );

  container.registerSingleton(
    VerificationTokens.ProjectMindGetVerificationSummaryHandler,
    () =>
      new ProjectMindGetVerificationSummaryHandler(
        container.resolve(VerificationTokens.IVerificationQueryService)
      )
  );

  container.registerSingleton(
    VerificationTokens.ProjectMindGetVerificationTimelineHandler,
    () =>
      new ProjectMindGetVerificationTimelineHandler(
        container.resolve(VerificationTokens.IVerificationQueryService)
      )
  );

  container.registerSingleton(
    VerificationTokens.ProjectMindGetCompletionEvidenceHandler,
    () =>
      new ProjectMindGetCompletionEvidenceHandler(
        container.resolve(VerificationTokens.IVerificationQueryService)
      )
  );

  container.registerSingleton(
    VerificationTokens.ProjectMindGetVerificationConflictsHandler,
    () =>
      new ProjectMindGetVerificationConflictsHandler(
        container.resolve(VerificationTokens.IVerificationQueryService)
      )
  );
}
