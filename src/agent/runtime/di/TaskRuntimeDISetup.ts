import type { DIContainer } from '../../../workspace/di/DIContainer.js';
import type { IEventBus } from '../../../workspace/interfaces/IEventBus.js';
import type { IAgentContextSessionManager } from '../../context/interfaces/IAgentContextSessionManager.js';
import type { IAgentSessionManager } from '../../interfaces/IAgentSessionManager.js';
import { TaskRuntimeTokens } from './TaskRuntimeTokens.js';
import { InMemoryTaskStore } from '../services/InMemoryTaskStore.js';
import { TaskManager } from '../services/TaskManager.js';
import { TaskLifecycleManager } from '../services/TaskLifecycleManager.js';
import { TaskCompletionValidator } from '../services/TaskCompletionValidator.js';
import { TaskProgressTracker } from '../services/TaskProgressTracker.js';
import { TaskExecutionCoordinator } from '../services/TaskExecutionCoordinator.js';
import { TaskVerificationCoordinator } from '../services/TaskVerificationCoordinator.js';
import { TaskRecoveryManager } from '../services/TaskRecoveryManager.js';
import { TaskRuntime } from '../services/TaskRuntime.js';

export interface TaskRuntimeSetupDependencies {
  readonly eventBus?: IEventBus | undefined;
  readonly contextSessionManager?: IAgentContextSessionManager | undefined;
  readonly agentSessionManager?: IAgentSessionManager | undefined;
}

export function createTaskRuntime(deps: TaskRuntimeSetupDependencies = {}): TaskRuntime {
  const store = new InMemoryTaskStore();
  const taskManager = new TaskManager(store, deps.eventBus);
  const lifecycleManager = new TaskLifecycleManager(store, deps.eventBus);
  const completionValidator = new TaskCompletionValidator(store);
  const progressTracker = new TaskProgressTracker(store, completionValidator);
  const executionCoordinator = new TaskExecutionCoordinator({
    store,
    taskManager,
    lifecycleManager,
    contextSessionManager: deps.contextSessionManager,
    eventBus: deps.eventBus,
  });
  const verificationCoordinator = new TaskVerificationCoordinator({
    store,
    taskManager,
    lifecycleManager,
    eventBus: deps.eventBus,
  });
  const recoveryManager = new TaskRecoveryManager({
    store,
    taskManager,
    lifecycleManager,
    contextSessionManager: deps.contextSessionManager,
  });

  return new TaskRuntime({
    taskManager,
    lifecycleManager,
    executionCoordinator,
    verificationCoordinator,
    progressTracker,
    completionValidator,
    recoveryManager,
    contextSessionManager: deps.contextSessionManager,
    agentSessionManager: deps.agentSessionManager,
  });
}

export class TaskRuntimeDISetup {
  public static register(container: DIContainer, deps: TaskRuntimeSetupDependencies = {}): void {
    const store = new InMemoryTaskStore();
    const taskManager = new TaskManager(store, deps.eventBus);
    const lifecycleManager = new TaskLifecycleManager(store, deps.eventBus);
    const completionValidator = new TaskCompletionValidator(store);
    const progressTracker = new TaskProgressTracker(store, completionValidator);
    const executionCoordinator = new TaskExecutionCoordinator({
      store,
      taskManager,
      lifecycleManager,
      contextSessionManager: deps.contextSessionManager,
      eventBus: deps.eventBus,
    });
    const verificationCoordinator = new TaskVerificationCoordinator({
      store,
      taskManager,
      lifecycleManager,
      eventBus: deps.eventBus,
    });
    const recoveryManager = new TaskRecoveryManager({
      store,
      taskManager,
      lifecycleManager,
      contextSessionManager: deps.contextSessionManager,
    });

    const runtime = new TaskRuntime({
      taskManager,
      lifecycleManager,
      executionCoordinator,
      verificationCoordinator,
      progressTracker,
      completionValidator,
      recoveryManager,
      contextSessionManager: deps.contextSessionManager,
      agentSessionManager: deps.agentSessionManager,
    });

    container.registerFactory(TaskRuntimeTokens.ITaskStore, () => store, 'Singleton');
    container.registerFactory(TaskRuntimeTokens.ITaskManager, () => taskManager, 'Singleton');
    container.registerFactory(TaskRuntimeTokens.ITaskLifecycleManager, () => lifecycleManager, 'Singleton');
    container.registerFactory(TaskRuntimeTokens.ITaskCompletionValidator, () => completionValidator, 'Singleton');
    container.registerFactory(TaskRuntimeTokens.ITaskProgressTracker, () => progressTracker, 'Singleton');
    container.registerFactory(TaskRuntimeTokens.ITaskExecutionCoordinator, () => executionCoordinator, 'Singleton');
    container.registerFactory(TaskRuntimeTokens.ITaskVerificationCoordinator, () => verificationCoordinator, 'Singleton');
    container.registerFactory(TaskRuntimeTokens.ITaskRecoveryManager, () => recoveryManager, 'Singleton');
    container.registerFactory(TaskRuntimeTokens.ITaskRuntime, () => runtime, 'Singleton');
  }
}
