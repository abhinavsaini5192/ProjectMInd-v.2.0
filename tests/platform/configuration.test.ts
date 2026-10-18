import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PlatformConfigLoader } from '../../src/platform/config/PlatformConfigLoader.js';
import { PlatformConfigValidator, PlatformConfigurationError } from '../../src/platform/config/PlatformConfigValidator.js';

describe('Platform Configuration & Environment Validation', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('loads valid default development configuration when environment is development', () => {
    delete process.env['NODE_ENV'];
    delete process.env['PROJECTMIND_ENV'];

    const config = PlatformConfigLoader.load();
    expect(config.app.name).toBe('projectmind');
    expect(config.app.env).toBe('development');
    expect(config.app.logLevel).toBe('INFO');
    expect(config.runtime.enabled).toBe(true);
    expect(config.runtime.maxConcurrentSessions).toBe(10);
    expect(config.runtime.maxConcurrentTasks).toBe(20);
    expect(config.storage.type).toBe('memory');
    expect(config.observability.logFormat).toBe('json');
  });

  it('applies environment variable overrides correctly', () => {
    process.env['PROJECTMIND_ENV'] = 'production';
    process.env['PROJECTMIND_LOG_LEVEL'] = 'WARN';
    process.env['PROJECTMIND_MAX_SESSIONS'] = '50';
    process.env['PROJECTMIND_STORAGE_TYPE'] = 'sqlite';
    process.env['PROJECTMIND_STORAGE_LOCATION'] = '/var/data/pm';
    process.env['PROJECTMIND_MASTER_KEY'] = '0123456789abcdef0123456789abcdef';

    const config = PlatformConfigLoader.load();
    expect(config.app.env).toBe('production');
    expect(config.app.logLevel).toBe('WARN');
    expect(config.runtime.maxConcurrentSessions).toBe(50);
    expect(config.storage.type).toBe('sqlite');
    expect(config.storage.location).toBe('/var/data/pm');
    expect(config.security.masterKey).toBe('0123456789abcdef0123456789abcdef');
  });

  it('fails fast when numeric limits are negative or invalid', () => {
    expect(() => {
      PlatformConfigValidator.validate({
        runtime: {
          maxConcurrentSessions: -5,
        },
      });
    }).toThrow(PlatformConfigurationError);
  });

  it('enforces production strictness: rejects unsafe dev defaults in production', () => {
    expect(() => {
      PlatformConfigValidator.validate({
        app: { env: 'production' },
        security: { allowUnsafeDevDefaults: true },
      });
    }).toThrow(PlatformConfigurationError);
  });

  it('enforces production strictness: rejects in-memory sqlite in production', () => {
    expect(() => {
      PlatformConfigValidator.validate({
        app: { env: 'production' },
        storage: { type: 'sqlite', location: ':memory:' },
      });
    }).toThrow(PlatformConfigurationError);
  });
});
