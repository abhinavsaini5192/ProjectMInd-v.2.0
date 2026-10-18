import { describe, it, expect } from 'vitest';
import { AgentRequestValidator } from '../../src/agent/runtime/AgentRequestValidator.js';
import { AgentValidationError } from '../../src/agent/errors/AgentValidationError.js';
import { AgentVersionError } from '../../src/agent/errors/AgentVersionError.js';
import { AgentScopeError } from '../../src/agent/errors/AgentScopeError.js';
import { AgentOperationError } from '../../src/agent/errors/AgentOperationError.js';
import { createTestRequest } from './AgentTestHelper.js';

describe('AgentRequestValidator', () => {
  it('passes a well-formed request', () => {
    const req = createTestRequest('GET_CONTEXT', { taskText: 'Implement feature' });
    expect(() => AgentRequestValidator.validate(req)).not.toThrow();
  });

  it('rejects requests missing requestId', () => {
    const req = createTestRequest('GET_CONTEXT', {}, { requestId: '' });
    expect(() => AgentRequestValidator.validate(req)).toThrow(AgentValidationError);
  });

  it('rejects requests with unsupported protocol versions', () => {
    const req = createTestRequest('GET_CONTEXT', {}, { protocolVersion: '99.0' });
    expect(() => AgentRequestValidator.validate(req)).toThrow(AgentVersionError);
  });

  it('rejects requests missing agentId', () => {
    const req = createTestRequest('GET_CONTEXT', {}, { agentId: '' });
    expect(() => AgentRequestValidator.validate(req)).toThrow(AgentValidationError);
  });

  it('rejects requests with invalid operation type', () => {
    const req = createTestRequest('NON_EXISTENT_OP' as any, {});
    expect(() => AgentRequestValidator.validate(req)).toThrow(AgentValidationError);
  });

  it('rejects requests with missing or empty workspace scope', () => {
    const req1 = createTestRequest('GET_CONTEXT', {}, {
      workspaceContext: { workspaceId: '', repositoryId: 'repo_a' },
    });
    expect(() => AgentRequestValidator.validate(req1)).toThrow(AgentScopeError);

    const req2 = createTestRequest('GET_CONTEXT', {}, {
      workspaceContext: { workspaceId: 'ws_a', repositoryId: '' },
    });
    expect(() => AgentRequestValidator.validate(req2)).toThrow(AgentScopeError);
  });

  it('rejects boundary escape payloads attempting arbitrary command execution', () => {
    const dangerousPayloads = [
      { shellCommand: 'rm -rf /' },
      { exec: 'cat /etc/passwd' },
      { eval: 'process.exit(1)' },
      { spawn: 'bash' },
      { bypassSecurity: true },
    ];

    for (const payload of dangerousPayloads) {
      const req = createTestRequest('GET_CONTEXT', payload);
      expect(() => AgentRequestValidator.validate(req)).toThrow(AgentOperationError);
    }
  });
});
