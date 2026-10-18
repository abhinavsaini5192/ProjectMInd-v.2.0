import { DIContainer } from '../../../workspace/di/DIContainer.js';
import { ObservationTokens } from './ObservationTokens.js';
import { InMemoryObservationStore } from '../services/InMemoryObservationStore.js';
import { ObservationValidator } from '../validators/ObservationValidator.js';
import { ObservationNormalizer } from '../normalizers/ObservationNormalizer.js';
import { ObservationClassifier } from '../classifiers/ObservationClassifier.js';
import { ObservationConflictResolver } from '../services/ObservationConflictResolver.js';
import { ObservationCorrelator } from '../correlators/ObservationCorrelator.js';
import { ObservationProcessor } from '../processors/ObservationProcessor.js';
import { ObservationQueryService } from '../services/ObservationQueryService.js';
import { ProjectMindGetExecutionObservationsHandler } from '../handlers/ProjectMindGetExecutionObservationsHandler.js';
import { ProjectMindGetTaskTimelineHandler } from '../handlers/ProjectMindGetTaskTimelineHandler.js';
import { ProjectMindGetExecutionSummaryHandler } from '../handlers/ProjectMindGetExecutionSummaryHandler.js';
import { ProjectMindGetObservationConflictsHandler } from '../handlers/ProjectMindGetObservationConflictsHandler.js';
import { TaskRuntimeTokens } from '../../runtime/di/TaskRuntimeTokens.js';
import { AgentContextTokens } from '../../context/di/AgentContextTokens.js';

export function registerObservationServices(container: DIContainer): void {
  // Store
  container.registerSingleton(ObservationTokens.IObservationStore, () => new InMemoryObservationStore());

  // Validator & Normalizer
  container.registerSingleton(ObservationTokens.IObservationValidator, () => new ObservationValidator());
  container.registerSingleton(
    ObservationTokens.IObservationNormalizer,
    () => new ObservationNormalizer(container.resolve(ObservationTokens.IObservationValidator))
  );

  // Classifier, ConflictResolver, Correlator
  container.registerSingleton(ObservationTokens.IObservationClassifier, () => new ObservationClassifier());
  container.registerSingleton(ObservationTokens.ObservationConflictResolver, () => new ObservationConflictResolver());
  container.registerSingleton(
    ObservationTokens.IObservationCorrelator,
    () => new ObservationCorrelator(container.resolve(ObservationTokens.ObservationConflictResolver))
  );

  // Processor
  container.registerSingleton(
    ObservationTokens.IObservationProcessor,
    () =>
      new ObservationProcessor({
        store: container.resolve(ObservationTokens.IObservationStore),
        normalizer: container.resolve(ObservationTokens.IObservationNormalizer),
        validator: container.resolve(ObservationTokens.IObservationValidator),
        classifier: container.resolve(ObservationTokens.IObservationClassifier),
        correlator: container.resolve(ObservationTokens.IObservationCorrelator),
        eventBus: container.hasRegistration(Symbol.for('IEventBus'))
          ? container.resolve(Symbol.for('IEventBus'))
          : undefined,
        taskRuntime: container.hasRegistration(TaskRuntimeTokens.ITaskRuntime)
          ? container.resolve(TaskRuntimeTokens.ITaskRuntime)
          : undefined,
        contextSessionManager: container.hasRegistration(AgentContextTokens.IAgentContextSessionManager)
          ? container.resolve(AgentContextTokens.IAgentContextSessionManager)
          : undefined,
      })
  );

  // Query Service
  container.registerSingleton(
    ObservationTokens.IObservationQueryService,
    () =>
      new ObservationQueryService(
        container.resolve(ObservationTokens.IObservationStore),
        container.resolve(ObservationTokens.IObservationValidator)
      )
  );

  // Handlers
  container.registerSingleton(
    ObservationTokens.ProjectMindGetExecutionObservationsHandler,
    () => new ProjectMindGetExecutionObservationsHandler(container.resolve(ObservationTokens.IObservationQueryService))
  );

  container.registerSingleton(
    ObservationTokens.ProjectMindGetTaskTimelineHandler,
    () => new ProjectMindGetTaskTimelineHandler(container.resolve(ObservationTokens.IObservationQueryService))
  );

  container.registerSingleton(
    ObservationTokens.ProjectMindGetExecutionSummaryHandler,
    () => new ProjectMindGetExecutionSummaryHandler(container.resolve(ObservationTokens.IObservationQueryService))
  );

  container.registerSingleton(
    ObservationTokens.ProjectMindGetObservationConflictsHandler,
    () => new ProjectMindGetObservationConflictsHandler(container.resolve(ObservationTokens.IObservationQueryService))
  );
}
