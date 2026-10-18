import { describe, it, expect } from 'vitest';
import { KnowledgeUpdateValidator } from '../../../src/knowledge/update/core/KnowledgeUpdateValidator.js';
import { KnowledgeUpdateNormalizer } from '../../../src/knowledge/update/core/KnowledgeUpdateNormalizer.js';
import {
  InvalidKnowledgeUpdateError,
  KnowledgeUpdateScopeError,
} from '../../../src/knowledge/update/errors/KnowledgeUpdateError.js';

describe('KnowledgeUpdate Security & Validation', () => {
  const validator = new KnowledgeUpdateValidator();
  const normalizer = new KnowledgeUpdateNormalizer();

  it('rejects updates with empty repositoryId', () => {
    const update = normalizer.normalize({
      repositoryId: '   ',
      source: 'MANUAL',
      updateType: 'RESOURCE_CHANGED',
    });

    expect(() => validator.validate(update)).toThrow(KnowledgeUpdateScopeError);
  });

  it('rejects path traversal attempts with .. or null bytes', () => {
    const update = normalizer.normalize({
      repositoryId: 'repo-1',
      source: 'MANUAL',
      updateType: 'RESOURCE_CHANGED',
      affectedResources: ['../../etc/shadow'],
    });

    expect(() => validator.validate(update)).toThrow(InvalidKnowledgeUpdateError);
  });

  it('rejects absolute system paths outside repository', () => {
    const update = normalizer.normalize({
      repositoryId: 'repo-1',
      source: 'MANUAL',
      updateType: 'RESOURCE_CHANGED',
      affectedResources: ['/etc/passwd'],
    });

    expect(() => validator.validate(update)).toThrow(InvalidKnowledgeUpdateError);
  });

  it('rejects agents attempting to claim SYSTEM_VERIFIED provenance (anti-forging)', () => {
    const update = normalizer.normalize({
      repositoryId: 'repo-1',
      source: 'AGENT' as any,
      provenance: 'SYSTEM_VERIFIED',
      updateType: 'RESOURCE_CHANGED',
    });

    expect(() => validator.validate(update)).toThrow(InvalidKnowledgeUpdateError);
  });

  it('redacts sensitive API tokens, secrets, and bearer credentials from metadata', () => {
    const metadata = {
      apiKey: 'ghp_123456789012345678901234567890123456',
      npmToken: 'npm_abcdefghijklmnopqrstuvwxyz1234567890',
      anthropic: 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz',
      openai: 'sk-abcdefghijklmnopqrstuvwxyz1234',
      bearer: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy',
      generic: 'secret="supersecretpassword123"',
      safeConfig: 'PORT=3000',
    };

    const sanitized = validator.sanitizeMetadata(metadata);
    expect(sanitized['apiKey']).toBe('[REDACTED_SECRET]');
    expect(sanitized['npmToken']).toBe('[REDACTED_SECRET]');
    expect(sanitized['anthropic']).toBe('[REDACTED_SECRET]');
    expect(sanitized['openai']).toBe('[REDACTED_SECRET]');
    expect(sanitized['bearer']).toBe('Bearer [REDACTED_SECRET]');
    expect(sanitized['safeConfig']).toBe('PORT=3000');
  });
});
