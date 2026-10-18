import { describe, it, expect, beforeEach } from 'vitest';
import {
  ObservabilityLogger,
  LogSanitizer,
  CorrelationContext,
  type LogEvent,
} from '../../src/observability/index.js';

describe('Observability - Structured Logging & Sanitization', () => {
  let capturedLogs: LogEvent[];
  let logger: ObservabilityLogger;
  let sanitizer: LogSanitizer;

  beforeEach(() => {
    capturedLogs = [];
    sanitizer = new LogSanitizer();
    logger = new ObservabilityLogger({
      minLevel: 'DEBUG',
      serviceName: 'test-service',
      sink: (_line, event) => {
        capturedLogs.push(event);
      },
      sanitizer,
    });
  });

  it('records structured log event with canonical fields', () => {
    logger.logEvent({
      level: 'INFO',
      service: 'test-service',
      component: 'auth',
      operation: 'login',
      message: 'User logged in successfully',
      requestId: 'req-123',
      correlationId: 'corr-456',
      durationMs: 42,
      outcome: 'SUCCESS',
      metadata: { userId: 'u1' },
    });

    expect(capturedLogs).toHaveLength(1);
    const event = capturedLogs[0]!;
    expect(event.eventId).toBeDefined();
    expect(event.timestamp).toBeDefined();
    expect(event.level).toBe('INFO');
    expect(event.service).toBe('test-service');
    expect(event.component).toBe('auth');
    expect(event.operation).toBe('login');
    expect(event.message).toBe('User logged in successfully');
    expect(event.requestId).toBe('req-123');
    expect(event.correlationId).toBe('corr-456');
    expect(event.durationMs).toBe(42);
    expect(event.outcome).toBe('SUCCESS');
    expect(event.metadata).toEqual({ userId: 'u1' });
  });

  it('redacts sensitive fields from metadata and messages', () => {
    logger.logEvent({
      level: 'INFO',
      service: 'test-service',
      component: 'gateway',
      operation: 'forward',
      message: 'Incoming request with Bearer secret-token-xyz123',
      metadata: {
        password: 'super-secret-password',
        api_key: 'sk-1234567890abcdef1234567890abcdef',
        token: 'auth-jwt-token',
        nested: {
          client_secret: 'nested-secret-value',
          safeField: 'normalValue',
        },
      },
    });

    expect(capturedLogs).toHaveLength(1);
    const event = capturedLogs[0]!;
    expect(event.message).not.toContain('secret-token-xyz123');
    expect(event.message).toContain('[REDACTED]');

    const meta = event.metadata as Record<string, any>;
    expect(meta.password).toBe('[REDACTED]');
    expect(meta.api_key).toBe('[REDACTED]');
    expect(meta.token).toBe('[REDACTED]');
    expect(meta.nested.client_secret).toBe('[REDACTED]');
    expect(meta.nested.safeField).toBe('normalValue');
  });

  it('automatically captures ambient correlation IDs via AsyncLocalStorage', () => {
    CorrelationContext.run(
      {
        requestId: 'ambient-req-999',
        correlationId: 'ambient-corr-888',
        traceId: 'ambient-trace-777',
        workspaceId: 'ws-test',
        repositoryId: 'repo-test',
      },
      () => {
        logger.info({
          component: 'worker',
          operation: 'process',
          message: 'Processing task with ambient context',
        });
      }
    );

    expect(capturedLogs).toHaveLength(1);
    const event = capturedLogs[0]!;
    expect(event.requestId).toBe('ambient-req-999');
    expect(event.correlationId).toBe('ambient-corr-888');
    expect(event.traceId).toBe('ambient-trace-777');
    expect(event.workspaceId).toBe('ws-test');
    expect(event.repositoryId).toBe('repo-test');
  });

  it('respects log level filtering', () => {
    const infoLogger = new ObservabilityLogger({
      minLevel: 'INFO',
      sink: (_line, event) => capturedLogs.push(event),
    });

    infoLogger.debug({
      component: 'test',
      operation: 'debug_op',
      message: 'This should be ignored',
    });

    infoLogger.info({
      component: 'test',
      operation: 'info_op',
      message: 'This should be recorded',
    });

    expect(capturedLogs).toHaveLength(1);
    expect(capturedLogs[0]!.operation).toBe('info_op');
  });

  it('isolates sink errors without crashing execution', () => {
    const faultyLogger = new ObservabilityLogger({
      sink: () => {
        throw new Error('Sink network failure');
      },
    });

    expect(() => {
      faultyLogger.info({
        component: 'test',
        operation: 'faulty_sink',
        message: 'Should not throw',
      });
    }).not.toThrow();

    expect(faultyLogger.getBufferedEvents()).toHaveLength(1);
  });
});
