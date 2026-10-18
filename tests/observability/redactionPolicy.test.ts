import { describe, it, expect } from 'vitest';
import { LogSanitizer } from '../../src/observability/logging/LogSanitizer.js';

describe('Log Sanitizer & Secret Redaction Policy Suite', () => {
  it('redacts common API tokens and secret strings from messages', () => {
    // OpenAI API Key
    const openAiMsg = 'Failed calling LLM with key sk-abcdef1234567890abcdef1234567890';
    expect(LogSanitizer.sanitizeMessage(openAiMsg)).toContain('[REDACTED]');
    expect(LogSanitizer.sanitizeMessage(openAiMsg)).not.toContain('sk-abcdef1234567890abcdef1234567890');

    // Anthropic API Key
    const anthropicMsg = 'Error using key sk-ant-api03-abcdef123456789012345678901234';
    expect(LogSanitizer.sanitizeMessage(anthropicMsg)).toContain('[REDACTED]');
    expect(LogSanitizer.sanitizeMessage(anthropicMsg)).not.toContain('sk-ant-api03-');

    // GitHub PAT
    const githubMsg = 'Cloning repo using token ghp_1234567890abcdefghijklmnopqrstuvwxyzAB';
    expect(LogSanitizer.sanitizeMessage(githubMsg)).toContain('[REDACTED]');
    expect(LogSanitizer.sanitizeMessage(githubMsg)).not.toContain('ghp_1234567890');

    // Slack token
    const slackMsg = 'Slack notification failed token xoxb-mockslacktoken12345';
    expect(LogSanitizer.sanitizeMessage(slackMsg)).toContain('[REDACTED]');

    // AWS Access Key
    const awsMsg = 'S3 connect with key AKIAIOSFODNN7EXAMPLE';
    expect(LogSanitizer.sanitizeMessage(awsMsg)).toContain('[REDACTED]');
    expect(LogSanitizer.sanitizeMessage(awsMsg)).not.toContain('AKIAIOSFODNN7EXAMPLE');
  });

  it('redacts URI embedded credentials in connection strings', () => {
    const uri = 'Connecting to postgres://admin:super_secret_password_123@db.prod.internal:5432/mind';
    const sanitized = LogSanitizer.sanitizeMessage(uri);
    expect(sanitized).not.toContain('super_secret_password_123');
    expect(sanitized).toContain('://admin:[REDACTED]@');
  });

  it('redacts sensitive fields in nested metadata objects', () => {
    const metadata = {
      user: 'alice',
      password: 'password123',
      nested: {
        apiKey: 'secret-key-value',
        token: 'auth-token-xyz',
        auth: {
          authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDcSemACt8x4iTMCda8Yhe3iZaWbvV5XKSTbuAn0M',
          creditCard: '4111111111111111',
        },
      },
      safeField: 'visible_data',
    };

    const sanitized = LogSanitizer.sanitizeMetadata(metadata);
    expect(sanitized['password']).toBe('[REDACTED]');
    expect(sanitized['safeField']).toBe('visible_data');

    const nested = sanitized['nested'] as Record<string, unknown>;
    expect(nested['apiKey']).toBe('[REDACTED]');
    expect(nested['token']).toBe('[REDACTED]');

    const auth = nested['auth'] as Record<string, unknown>;
    expect(auth['authorization']).toBe('[REDACTED]');
    expect(auth['creditCard']).toBe('[REDACTED]');
  });

  it('prevents multiline log injection / CWE-117 log forgery', () => {
    const maliciousInput = 'User login failed\r\n2026-10-18T10:00:00.000Z [SECURITY] Admin privileges granted to user=attacker\r\n';
    const sanitized = LogSanitizer.sanitizeMessage(maliciousInput);

    // Carriage return and newline characters must be escaped so attacker cannot inject false log records
    expect(sanitized).not.toContain('\r');
    expect(sanitized).not.toContain('\n');
    expect(sanitized).toContain('\\r');
    expect(sanitized).toContain('\\n');
  });

  it('handles circular references and non-object metadata safely', () => {
    const circular: Record<string, unknown> = { name: 'circular_test' };
    circular['self'] = circular;

    expect(() => LogSanitizer.sanitizeMetadata(circular)).not.toThrow();
    const sanitized = LogSanitizer.sanitizeMetadata(circular);
    expect(sanitized['self']).toBe('[CIRCULAR]');
  });
});
