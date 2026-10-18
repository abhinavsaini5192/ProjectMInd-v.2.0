import type { Job } from '../models/Job.js';
import type { IMetricsRegistry } from '../../observability/metrics/MetricTypes.js';
import type { ITracer } from '../../observability/tracing/TraceTypes.js';
import type { ObservabilityLogger } from '../../observability/logging/ObservabilityLogger.js';
import { CorrelationContext } from '../../observability/correlation/CorrelationContext.js';

export const JOB_METRIC_NAMES = {
  JOBS_ENQUEUED_TOTAL: 'jobs_enqueued_total',
  JOBS_COMPLETED_TOTAL: 'jobs_completed_total',
  JOBS_FAILED_TOTAL: 'jobs_failed_total',
  JOBS_RETRIED_TOTAL: 'jobs_retried_total',
  JOBS_DEAD_LETTERED_TOTAL: 'jobs_dead_lettered_total',
  JOBS_CANCELLED_TOTAL: 'jobs_cancelled_total',
  JOB_EXECUTION_DURATION_MS: 'job_execution_duration_ms',
  JOB_QUEUE_WAIT_TIME_MS: 'job_queue_wait_time_ms',
} as const;

export class JobTelemetry {
  constructor(
    private readonly metrics?: IMetricsRegistry | undefined,
    private readonly tracer?: ITracer | undefined,
    private readonly logger?: ObservabilityLogger | undefined
  ) {}

  public recordJobEnqueued(job: Job): void {
    const boundedType = job.type.substring(0, 32);
    this.metrics?.counter(JOB_METRIC_NAMES.JOBS_ENQUEUED_TOTAL).increment(1, {
      type: boundedType,
      priority: job.priority,
    });

    this.logger?.logEvent({
      level: 'INFO',
      service: 'projectmind',
      component: 'job-dispatcher',
      operation: 'enqueue_job',
      message: `Enqueued background job ${job.jobId} of type '${job.type}' (priority=${job.priority})`,
      workspaceId: job.workspaceId,
      repositoryId: job.repositoryId,
      correlationId: job.correlationId,
      traceId: job.traceId,
      outcome: 'SUCCESS',
      metadata: {
        jobId: job.jobId,
        type: job.type,
        priority: job.priority,
      },
    });
  }

  public recordJobExecution(job: Job, durationMs: number, success: boolean): void {
    const boundedType = job.type.substring(0, 32);
    const metricName = success
      ? JOB_METRIC_NAMES.JOBS_COMPLETED_TOTAL
      : JOB_METRIC_NAMES.JOBS_FAILED_TOTAL;

    this.metrics?.counter(metricName).increment(1, {
      type: boundedType,
      priority: job.priority,
    });

    this.metrics?.histogram(JOB_METRIC_NAMES.JOB_EXECUTION_DURATION_MS).record(durationMs, {
      type: boundedType,
      success: String(success),
    });

    this.logger?.logEvent({
      level: success ? 'INFO' : 'ERROR',
      service: 'projectmind',
      component: 'job-worker',
      operation: 'execute_job',
      message: `Job ${job.jobId} [${job.type}] ${success ? 'completed' : 'failed'} in ${durationMs}ms`,
      durationMs,
      workspaceId: job.workspaceId,
      repositoryId: job.repositoryId,
      correlationId: job.correlationId,
      traceId: job.traceId,
      outcome: success ? 'SUCCESS' : 'FAILURE',
      metadata: {
        jobId: job.jobId,
        type: job.type,
        workerId: job.workerId,
      },
    });
  }

  public recordJobRetry(job: Job, attempt: number): void {
    const boundedType = job.type.substring(0, 32);
    this.metrics?.counter(JOB_METRIC_NAMES.JOBS_RETRIED_TOTAL).increment(1, {
      type: boundedType,
      attempt: String(attempt),
    });

    this.logger?.logEvent({
      level: 'WARN',
      service: 'projectmind',
      component: 'job-worker',
      operation: 'retry_job',
      message: `Job ${job.jobId} [${job.type}] failed, scheduled retry attempt ${attempt}/${job.maxRetries}`,
      workspaceId: job.workspaceId,
      repositoryId: job.repositoryId,
      correlationId: job.correlationId,
      outcome: 'FAILURE',
      metadata: {
        jobId: job.jobId,
        type: job.type,
        attempt,
      },
    });
  }

  public recordJobDeadLetter(job: Job, reason: string): void {
    const boundedType = job.type.substring(0, 32);
    this.metrics?.counter(JOB_METRIC_NAMES.JOBS_DEAD_LETTERED_TOTAL).increment(1, {
      type: boundedType,
    });

    this.logger?.logEvent({
      level: 'FATAL',
      service: 'projectmind',
      component: 'job-recovery',
      operation: 'dead_letter_job',
      message: `Job ${job.jobId} [${job.type}] routed to dead-letter queue: ${reason}`,
      workspaceId: job.workspaceId,
      repositoryId: job.repositoryId,
      correlationId: job.correlationId,
      outcome: 'FAILURE',
      metadata: {
        jobId: job.jobId,
        type: job.type,
        reason,
      },
    });
  }

  public recordJobCancelled(job: Job, reason: string): void {
    const boundedType = job.type.substring(0, 32);
    this.metrics?.counter(JOB_METRIC_NAMES.JOBS_CANCELLED_TOTAL).increment(1, {
      type: boundedType,
    });

    this.logger?.logEvent({
      level: 'INFO',
      service: 'projectmind',
      component: 'job-dispatcher',
      operation: 'cancel_job',
      message: `Job ${job.jobId} cancelled: ${reason}`,
      workspaceId: job.workspaceId,
      repositoryId: job.repositoryId,
      correlationId: job.correlationId,
      outcome: 'CANCELLED',
      metadata: {
        jobId: job.jobId,
        reason,
      },
    });
  }
}
