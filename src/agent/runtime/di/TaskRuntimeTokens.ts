export const TaskRuntimeTokens = {
  ITaskStore: Symbol.for('ITaskStore'),
  ITaskManager: Symbol.for('ITaskManager'),
  ITaskLifecycleManager: Symbol.for('ITaskLifecycleManager'),
  ITaskExecutionCoordinator: Symbol.for('ITaskExecutionCoordinator'),
  ITaskVerificationCoordinator: Symbol.for('ITaskVerificationCoordinator'),
  ITaskProgressTracker: Symbol.for('ITaskProgressTracker'),
  ITaskRecoveryManager: Symbol.for('ITaskRecoveryManager'),
  ITaskCompletionValidator: Symbol.for('ITaskCompletionValidator'),
  ITaskRuntime: Symbol.for('ITaskRuntime'),
};
