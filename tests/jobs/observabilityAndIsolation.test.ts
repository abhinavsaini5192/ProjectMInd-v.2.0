import { describe, it, expect, beforeEach } from 'vitest';
import {
  MetricsRegistry,
  ObservabilityLogger,
} from '../../src/observability/index.js';
import {
  JobTelemetry,
  JOB_METRIC_NAMES,
  Worker,
  InMemoryJobQueue,
  InMemoryJobRepository,
  JobRegistry,
  JobLeaseManager,
  DeadLetterQueue,
  JobDispatcher,
  type IJobHandler,
} from '../../src/jobs/index.js';

describe('Jobs - Observability Integration & Failure Isolation', () => {
  let metrics: MetricsRegistry;
  let logger: ObservabilityLogger;
  let telemetry: JobTelemetry;
  let queue: InMemoryJobQueue;
  let repository: InMemoryJobRepository;
  let registry: JobRegistry;
  let leaseManager: JobLeaseManager;
  let deadLetterQueue: DeadLetterQueue;
  let dispatcher: JobDispatcher;
  let worker: Worker;

  beforeEach(() => {
    metrics = new MetricsRegistry();
    logger = new ObservabilityLogger({ sink: () => {} });
    telemetry = new JobTelemetry(metrics, undefined, logger);

    queue = new InMemoryJobQueue();
    repository = new InMemoryJobRepository();
    registry = new JobRegistry();
    leaseManager = new JobLeaseManager();
    deadLetterQueue = new DeadLetterQueue();

    dispatcher = new JobDispatcher(queue, repository, telemetry);
    worker = new Worker(queue, repository, registry, leaseManager, deadLetterQueue, {
      telemetry,
      workerId: 'obs-worker',
    });
  });

  it('records metrics and structured logs on job lifecycle events', async () => {
    registry.register('KNOWLEDGE_UPDATE', {
      validate: () => {},
      execute: async () => ({}),
    });

    const job = await dispatcher.dispatch({
      type: 'KNOWLEDGE_UPDATE',
      workspaceId: 'ws-1',
      payload: {},
    });

    const snapshot1 = metrics.getSnapshot();
    expect(snapshot1.counters[JOB_METRIC_NAMES.JOBS_ENQUEUED_TOTAL]?.series[0]?.value).toBe(1);

    await worker.processNext();

    const snapshot2 = metrics.getSnapshot();
    expect(snapshot2.counters[JOB_METRIC_NAMES.JOBS_COMPLETED_TOTAL]?.series[0]?.value).toBe(1);
    expect(snapshot2.histograms[JOB_METRIC_NAMES.JOB_EXECUTION_DURATION_MS]?.series[0]?.value.count).toBe(1);
  });

  it('isolates worker failure so that subsequent jobs in queue continue unaffected', async () => {
    let job2Processed = false;

    // Handler 1 crashes with unhandled Error
    registry.register('INTEGRITY_CHECK', {
      validate: () => {
        throw new Error('Fatal unhandled crash in validator');
      },
      execute: async () => ({}),
    });

    // Handler 2 succeeds normally
    registry.register('FEATURE_DISCOVERY', {
      validate: () => {},
      execute: async () => {
        job2Processed = true;
        return {};
      },
    });

    // Enqueue bad job followed by good job
    await dispatcher.dispatch({
      type: 'INTEGRITY_CHECK',
      workspaceId: 'ws-1',
      payload: {},
      maxRetries: 0,
    });

    await dispatcher.dispatch({
      type: 'FEATURE_DISCOVERY',
      workspaceId: 'ws-1',
      payload: {},
    });

    // Process first (bad) job
    const p1 = await worker.processNext();
    expect(p1).toBe(true);

    // Process second (good) job
    const p2 = await worker.processNext();
    expect(p2).toBe(true);
    expect(job2Processed).toBe(true);
  });
});
