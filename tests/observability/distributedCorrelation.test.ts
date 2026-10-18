import { describe, it, expect } from 'vitest';
import { CorrelationContext } from '../../src/observability/correlation/CorrelationContext.js';
import { ObservabilityLogger } from '../../src/observability/logging/ObservabilityLogger.js';
import { LogLevel } from '../../src/observability/logging/LogEvent.js';

describe('Distributed Correlation & Context Propagation Suite', () => {
  it('maintains ambient context across asynchronous execution chains', async () => {
    const rootContext = CorrelationContext.createRootContext({
      correlationId: 'corr-api-chain-1',
      requestId: 'req-api-chain-1',
      role: 'api',
      workspaceId: 'ws-test',
    });

    await CorrelationContext.run(rootContext, async () => {
      expect(CorrelationContext.getCorrelationId()).toBe('corr-api-chain-1');
      expect(CorrelationContext.current()?.role).toBe('api');
      expect(CorrelationContext.current()?.workspaceId).toBe('ws-test');

      // Async step
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(CorrelationContext.getCorrelationId()).toBe('corr-api-chain-1');
      expect(CorrelationContext.current()?.requestId).toBe('req-api-chain-1');
    });
  });

  it('guarantees context isolation across concurrent asynchronous branches', async () => {
    const branchA = CorrelationContext.createRootContext({
      correlationId: 'corr-branch-A',
      requestId: 'req-branch-A',
    });

    const branchB = CorrelationContext.createRootContext({
      correlationId: 'corr-branch-B',
      requestId: 'req-branch-B',
    });

    const runBranch = async (
      ctx: typeof branchA,
      expectedCorr: string,
      expectedReq: string,
      delayMs: number
    ) => {
      return CorrelationContext.run(ctx, async () => {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        const current = CorrelationContext.current();
        expect(current?.correlationId).toBe(expectedCorr);
        expect(current?.requestId).toBe(expectedReq);
        return current?.correlationId;
      });
    };

    // Run both branches concurrently with different delays
    const [resultA, resultB] = await Promise.all([
      runBranch(branchA, 'corr-branch-A', 'req-branch-A', 25),
      runBranch(branchB, 'corr-branch-B', 'req-branch-B', 10),
    ]);

    expect(resultA).toBe('corr-branch-A');
    expect(resultB).toBe('corr-branch-B');
  });

  it('automatically injects ambient correlation context into structured log records', () => {
    const emittedLogs: any[] = [];
    const logger = new ObservabilityLogger({
      minLevel: 'DEBUG',
      sink: (_line, event) => emittedLogs.push(event),
    });

    const workerCtx = CorrelationContext.createRootContext({
      correlationId: 'corr-worker-job-99',
      causationId: 'job-parent-88',
      traceId: '1234567890abcdef1234567890abcdef',
      jobId: 'job-99',
      attemptNumber: 2,
      role: 'worker',
      instanceId: 'worker-inst-1',
    });

    CorrelationContext.run(workerCtx, () => {
      logger.logEvent({
        level: 'INFO',
        service: 'projectmind',
        component: 'worker-engine',
        operation: 'process_job',
        message: 'Processing batch indexing task',
      });
    });

    expect(emittedLogs.length).toBe(1);
    const log = emittedLogs[0];
    expect(log.correlationId).toBe('corr-worker-job-99');
    expect(log.causationId).toBe('job-parent-88');
    expect(log.traceId).toBe('1234567890abcdef1234567890abcdef');
    expect(log.jobId).toBe('job-99');
    expect(log.attemptNumber).toBe(2);
    expect(log.role).toBe('worker');
    expect(log.instanceId).toBe('worker-inst-1');
  });

  it('creates child context preserving traceId and establishing causation link', () => {
    const parentCtx = CorrelationContext.createRootContext({
      correlationId: 'corr-parent-root',
      requestId: 'req-parent-root',
      traceId: 'trace-parent-123456789012345678',
      role: 'api',
    });

    CorrelationContext.run(parentCtx, () => {
      const childCtx = CorrelationContext.createChildContext({
        role: 'worker',
        jobId: 'job-spawned-1',
      });

      // Child inherits traceId and correlationId
      expect(childCtx.correlationId).toBe('corr-parent-root');
      expect(childCtx.traceId).toBe('trace-parent-123456789012345678');
      // Child causationId defaults to parent correlationId/causationId
      expect(childCtx.causationId).toBe('corr-parent-root');
      // Child receives new spanId
      expect(childCtx.spanId).not.toBe(parentCtx.spanId);
      expect(childCtx.jobId).toBe('job-spawned-1');
      expect(childCtx.role).toBe('worker');
    });
  });
});
