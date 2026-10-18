export const JobTokens = {
  JobQueue: Symbol('IJobQueue'),
  JobRepository: Symbol('IJobRepository'),
  JobRegistry: Symbol('IJobRegistry'),
  JobDispatcher: Symbol('IJobDispatcher'),
  JobLeaseManager: Symbol('IJobLeaseManager'),
  DeadLetterQueue: Symbol('IDeadLetterQueue'),
  JobRecoveryManager: Symbol('JobRecoveryManager'),
  WorkerPool: Symbol('IWorkerPool'),
  Scheduler: Symbol('IScheduler'),
  EventJobRouter: Symbol('EventJobRouter'),
  JobTelemetry: Symbol('JobTelemetry'),
} as const;
