import { describe, it, expect } from 'vitest';
import { ProductionErrorBoundary } from '../../src/platform/errors/ProductionErrorBoundary.js';
import { PlatformError } from '../../src/platform/errors/PlatformError.js';

describe('Production Error Boundary', () => {
  it('suppresses stack traces and strips internal paths in production mode', () => {
    const boundary = new ProductionErrorBoundary('production');
    const internalErr = new PlatformError('Failed to read config from /var/app/secrets/pass.json', {
      code: 'CONFIGURATION_ERROR',
      requestId: 'req_123',
      correlationId: 'corr_456',
      suggestedRecovery: 'Check file path.',
    });

    const envelope = boundary.formatExternalResponse(internalErr, {
      requestId: 'req_123',
      correlationId: 'corr_456',
    });

    expect(envelope.error.code).toBe('CONFIGURATION_ERROR');
    expect(envelope.error.stack).toBeUndefined();
    expect(envelope.error.message).toContain('[INTERNAL_PATH]');
    expect(envelope.error.message).not.toContain('/var/app/secrets/pass.json');
    expect(envelope.error.requestId).toBe('req_123');
    expect(envelope.error.correlationId).toBe('corr_456');
  });

  it('preserves stack trace in development mode for easier debugging', () => {
    const boundary = new ProductionErrorBoundary('development');
    const devErr = new Error('Development test error');

    const envelope = boundary.formatExternalResponse(devErr);
    expect(envelope.error.code).toBe('INTERNAL_ERROR');
    expect(envelope.error.message).toBe('Development test error');
    expect(envelope.error.stack).toBeDefined();
  });

  it('safely wraps unknown error types without crashing', () => {
    const boundary = new ProductionErrorBoundary('production');
    const envelope = boundary.formatExternalResponse('A raw string error occurred');

    expect(envelope.error.code).toBe('INTERNAL_ERROR');
    expect(envelope.error.message).toBe('A raw string error occurred');
    expect(envelope.error.stack).toBeUndefined();
  });
});
