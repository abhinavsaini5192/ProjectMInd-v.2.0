import { describe, it, expect } from 'vitest';
import { ProductionLogger } from '../../src/platform/logging/ProductionLogger.js';

describe('Production Logger & Formatting', () => {
  it('suppresses DEBUG entries when minLevel is INFO', () => {
    const logs: string[] = [];
    const logger = new ProductionLogger({
      minLevel: 'INFO',
      sink: (line) => logs.push(line),
    });

    logger.debug({
      component: 'TestComp',
      operation: 'debugOp',
      message: 'This should be ignored',
    });

    logger.info({
      component: 'TestComp',
      operation: 'infoOp',
      message: 'This should be logged',
    });

    expect(logs.length).toBe(1);
    expect(logs[0]).toContain('This should be logged');
  });

  it('formats structured JSON output correctly with service metadata', () => {
    let emittedLine = '';
    const logger = new ProductionLogger({
      serviceName: 'test-service',
      serviceVersion: '2.0.0',
      env: 'production',
      format: 'json',
      sink: (line) => {
        emittedLine = line;
      },
    });

    logger.info({
      component: 'AuthService',
      operation: 'login',
      correlationId: 'corr_123',
      durationMs: 42,
      message: 'User session started',
    });

    const parsed = JSON.parse(emittedLine);
    expect(parsed.service).toBe('test-service');
    expect(parsed.version).toBe('2.0.0');
    expect(parsed.env).toBe('production');
    expect(parsed.severity).toBe('INFO');
    expect(parsed.component).toBe('AuthService');
    expect(parsed.operation).toBe('login');
    expect(parsed.correlationId).toBe('corr_123');
    expect(parsed.durationMs).toBe(42);
  });

  it('redacts sensitive fields in log details automatically', () => {
    let emittedLine = '';
    const logger = new ProductionLogger({
      format: 'json',
      sink: (line) => {
        emittedLine = line;
      },
    });

    logger.info({
      component: 'Security',
      operation: 'verify',
      message: 'Verifying client credentials',
      details: {
        apiKey: 'secret-key-12345',
        clientToken: 'jwt-token-67890',
        safeProperty: 'allow',
      },
    });

    const parsed = JSON.parse(emittedLine);
    expect(parsed.details.apiKey).toBe('[REDACTED]');
    expect(parsed.details.clientToken).toBe('[REDACTED]');
    expect(parsed.details.safeProperty).toBe('allow');
  });
});
