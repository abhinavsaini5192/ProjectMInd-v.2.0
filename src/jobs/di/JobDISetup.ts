import type { DIContainer } from '../../workspace/di/DIContainer.js';
import type { IEventBus } from '../../workspace/interfaces/IEventBus.js';
import { IEventBusToken } from '../../workspace/interfaces/IEventBus.js';
import { JobTokens } from './JobTokens.js';
import { InMemoryJobQueue } from '../queue/InMemoryJobQueue.js';
import { InMemoryJobRepository } from '../persistence/InMemoryJobRepository.js';
import { JobRegistry } from '../registry/JobRegistry.js';
import { JobLeaseManager } from '../recovery/JobLeaseManager.js';
import { DeadLetterQueue } from '../recovery/DeadLetterQueue.js';
import { JobRecoveryManager } from '../recovery/JobRecoveryManager.js';
import { JobDispatcher } from '../dispatch/JobDispatcher.js';
import { WorkerPool } from '../workers/WorkerPool.js';
import { JobScheduler } from '../scheduling/JobScheduler.js';
import { EventJobRouter } from '../dispatch/EventJobRouter.js';
import { JobTelemetry } from '../observability/JobTelemetry.js';

export interface JobServices {
  readonly queue: InMemoryJobQueue;
  readonly repository: InMemoryJobRepository;
  readonly registry: JobRegistry;
  readonly leaseManager: JobLeaseManager;
  readonly deadLetterQueue: DeadLetterQueue;
  readonly recoveryManager: JobRecoveryManager;
  readonly dispatcher: JobDispatcher;
  readonly workerPool: WorkerPool;
  readonly scheduler: JobScheduler;
  readonly router?: EventJobRouter | undefined;
  readonly telemetry: JobTelemetry;
}

export class JobDISetup {
  public static registerJobs(container: DIContainer, overrides: Partial<JobServices> = {}): JobServices {
    const queue = overrides.queue ?? new InMemoryJobQueue();
    const repository = overrides.repository ?? new InMemoryJobRepository();
    const registry = overrides.registry ?? new JobRegistry();
    const leaseManager = overrides.leaseManager ?? new JobLeaseManager();
    const deadLetterQueue = overrides.deadLetterQueue ?? new DeadLetterQueue();
    const telemetry = overrides.telemetry ?? new JobTelemetry();

    const dispatcher = overrides.dispatcher ?? new JobDispatcher(queue, repository, telemetry);
    const recoveryManager =
      overrides.recoveryManager ?? new JobRecoveryManager(leaseManager, queue, deadLetterQueue, repository);

    const workerPool =
      overrides.workerPool ??
      new WorkerPool(queue, repository, registry, leaseManager, deadLetterQueue, {
        concurrency: 4,
        workerOptions: { telemetry },
      });

    const scheduler = overrides.scheduler ?? new JobScheduler(dispatcher);

    let router = overrides.router;
    if (!router) {
      try {
        const eventBus = container.resolve<IEventBus>(IEventBusToken);
        if (eventBus) {
          router = new EventJobRouter(eventBus, dispatcher);
          router.registerDefaultRoutes();
        }
      } catch {
        // EventBus not available in container yet
      }
    }

    container.registerFactory(JobTokens.JobQueue, () => queue, 'Singleton');
    container.registerFactory(JobTokens.JobRepository, () => repository, 'Singleton');
    container.registerFactory(JobTokens.JobRegistry, () => registry, 'Singleton');
    container.registerFactory(JobTokens.JobLeaseManager, () => leaseManager, 'Singleton');
    container.registerFactory(JobTokens.DeadLetterQueue, () => deadLetterQueue, 'Singleton');
    container.registerFactory(JobTokens.JobRecoveryManager, () => recoveryManager, 'Singleton');
    container.registerFactory(JobTokens.JobDispatcher, () => dispatcher, 'Singleton');
    container.registerFactory(JobTokens.WorkerPool, () => workerPool, 'Singleton');
    container.registerFactory(JobTokens.Scheduler, () => scheduler, 'Singleton');
    if (router) {
      container.registerFactory(JobTokens.EventJobRouter, () => router, 'Singleton');
    }
    container.registerFactory(JobTokens.JobTelemetry, () => telemetry, 'Singleton');

    return {
      queue,
      repository,
      registry,
      leaseManager,
      deadLetterQueue,
      recoveryManager,
      dispatcher,
      workerPool,
      scheduler,
      router,
      telemetry,
    };
  }
}
