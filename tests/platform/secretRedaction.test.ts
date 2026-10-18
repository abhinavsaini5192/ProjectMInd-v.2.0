import { describe, it, expect } from 'vitest';
import { ConfigRedactor } from '../../src/platform/config/ConfigRedactor.js';
import { LogRedactor } from '../../src/platform/logging/LogRedactor.js';

describe('Platform Secret Redaction', () => {
  it('redacts sensitive fields in nested configuration objects', () => {
    const raw = {
      appName: 'projectmind',
      auth: {
        api_key: 'sk-1234567890abcdef',
        clientSecret: 'shhh-secret-value',
        token: 'eyJh...jwt',
        password: 'super-password',
      },
      metadata: {
        normalField: 'visible-value',
      },
    };

    const redacted = ConfigRedactor.redact(raw) as any;
    expect(redacted.appName).toBe('projectmind');
    expect(redacted.auth.api_key).toBe('[REDACTED]');
    expect(redacted.auth.clientSecret).toBe('[REDACTED]');
    expect(redacted.auth.token).toBe('[REDACTED]');
    expect(redacted.auth.password).toBe('[REDACTED]');
    expect(redacted.metadata.normalField).toBe('visible-value');
  });

  it('redacts credentials in connection strings', () => {
    const connStr = 'postgres://admin:secretPass123@db.prod.internal:5432/pmdb';
    const redacted = ConfigRedactor.redactString(connStr);
    expect(redacted).toBe('postgres://admin:[REDACTED]@db.prod.internal:5432/pmdb');

    // Redis with password only: redis://:pass@host
    const redisPassOnly = 'redis://:superSecretRedisPass@redis-host:6379';
    expect(ConfigRedactor.redactString(redisPassOnly)).toBe('redis://:[REDACTED]@redis-host:6379');

    // Redis with username and password: redis://user:pass@host/db
    const redisUserPass = 'redis://pm_user:superSecretRedisPass@redis-cluster:6379/1';
    expect(ConfigRedactor.redactString(redisUserPass)).toBe('redis://pm_user:[REDACTED]@redis-cluster:6379/1');

    // TLS Redis (rediss://)
    const redissUrl = 'rediss://admin:tlsPassword123@secure-redis:6380';
    expect(ConfigRedactor.redactString(redissUrl)).toBe('rediss://admin:[REDACTED]@secure-redis:6380');

    // Token-only userinfo: https://token@host
    const tokenUrl = 'https://ghp_abcdefghijklmnopqrstuvwxyz1234567890@github.com/org/repo';
    expect(ConfigRedactor.redactString(tokenUrl)).toBe('https://[REDACTED]@github.com/org/repo');
  });

  it('redacts sensitive HTTP headers', () => {
    const headers = {
      'content-type': 'application/json',
      'authorization': 'Bearer super-secret-jwt',
      'x-api-key': 'secret-api-key-value',
      'cookie': 'session_id=12345',
      'user-agent': 'Cursor/1.0',
    };

    const sanitized = LogRedactor.redactHeaders(headers);
    expect(sanitized['content-type']).toBe('application/json');
    expect(sanitized['authorization']).toBe('[REDACTED]');
    expect(sanitized['x-api-key']).toBe('[REDACTED]');
    expect(sanitized['cookie']).toBe('[REDACTED]');
    expect(sanitized['user-agent']).toBe('Cursor/1.0');
  });
});
