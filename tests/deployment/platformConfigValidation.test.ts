import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PlatformConfigLoader } from '../../src/platform/config/PlatformConfigLoader.js';
import { PlatformConfigValidator, PlatformConfigurationError } from '../../src/platform/config/PlatformConfigValidator.js';
import { ConfigRedactor } from '../../src/platform/config/ConfigRedactor.js';

describe('Phase 10.5 Deployment - Platform Config Validation', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('loads valid default deployment settings for role, server, and worker', () => {
    delete process.env['NODE_ENV'];
    delete process.env['PROJECTMIND_ENV'];
    delete process.env['PROJECTMIND_ROLE'];
    delete process.env['PORT'];

    const config = PlatformConfigLoader.load();
    expect(config.role).toBe('all');
    expect(config.server.port).toBe(3000);
    expect(config.server.host).toBe('0.0.0.0');
    expect(config.worker.concurrency).toBe(5);
    expect(config.worker.pollIntervalMs).toBe(250);
    expect(config.worker.visibilityTimeoutMs).toBe(30000);
    expect(config.database.walMode).toBe(true);
    expect(config.database.autoMigrate).toBe(true);
    expect(config.redis.enabled).toBe(false);
  });

  it('correctly maps deployment environment variables', () => {
    process.env['PROJECTMIND_ENV'] = 'production';
    process.env['PROJECTMIND_ROLE'] = 'api';
    process.env['PORT'] = '8080';
    process.env['PROJECTMIND_HOST'] = '127.0.0.1';
    process.env['PROJECTMIND_WORKER_CONCURRENCY'] = '16';
    process.env['PROJECTMIND_STORAGE_TYPE'] = 'sqlite';
    process.env['PROJECTMIND_STORAGE_LOCATION'] = '/var/lib/pm/data';
    process.env['PROJECTMIND_REDIS_ENABLED'] = 'true';
    process.env['PROJECTMIND_REDIS_URL'] = 'redis://user:supersecretpass@redis.internal:6379';
    process.env['PROJECTMIND_MASTER_KEY'] = '0123456789abcdef0123456789abcdef';

    const config = PlatformConfigLoader.load();
    expect(config.role).toBe('api');
    expect(config.server.port).toBe(8080);
    expect(config.server.host).toBe('127.0.0.1');
    expect(config.worker.concurrency).toBe(16);
    expect(config.redis.enabled).toBe(true);
    expect(config.redis.url).toBe('redis://user:supersecretpass@redis.internal:6379');
    expect(config.security.masterKey).toBe('0123456789abcdef0123456789abcdef');
  });

  it('fails fast on invalid server port numbers', () => {
    expect(() => {
      PlatformConfigValidator.validate({
        server: { port: 99999 },
      });
    }).toThrow(PlatformConfigurationError);

    expect(() => {
      PlatformConfigValidator.validate({
        server: { port: -1 },
      });
    }).toThrow(PlatformConfigurationError);
  });

  it('enforces that redis.url must be provided when redis is enabled', () => {
    expect(() => {
      PlatformConfigValidator.validate({
        redis: { enabled: true, url: '' },
      });
    }).toThrow(PlatformConfigurationError);
  });

  it('redacts passwords and sensitive tokens in validation errors and strings', () => {
    const rawUrl = 'redis://admin:superSecretPassword123@redis-host:6379';
    const redacted = ConfigRedactor.redactString(rawUrl);
    expect(redacted).not.toContain('superSecretPassword123');
    expect(redacted).toContain('[REDACTED]');

    const sensitiveObj = {
      apiKey: 'secret_live_abc123',
      sessionToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDcSemACt8x4iTMCda8Yhe3iZaWbvV5XKSTbuAn0M',
      host: 'api.projectmind.internal',
    };
    const redactedObj = ConfigRedactor.redact(sensitiveObj) as Record<string, unknown>;
    expect(redactedObj['apiKey']).toBe('[REDACTED]');
    expect(redactedObj['sessionToken']).toBe('[REDACTED]');
    expect(redactedObj['host']).toBe('api.projectmind.internal');
  });
});
