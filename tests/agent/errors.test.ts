import { describe, it, expect } from 'vitest';
import {
  AgentError,
  AgentNotFoundError,
  AgentSessionNotFoundError,
  AgentCapabilityError,
  AgentScopeError,
  AgentOperationError,
  AgentProtocolError,
  AgentValidationError,
  AgentVersionError,
  AgentTimeoutError,
  AgentConflictError,
} from '../../src/agent/errors/index.js';

describe('Agent Errors Hierarchy & Serialization', () => {
  it('correctly sets error codes and names across error classes', () => {
    const notFound = new AgentNotFoundError('agent_123');
    expect(notFound.code).toBe('AGENT_NOT_FOUND');
    expect(notFound.name).toBe('AgentNotFoundError');
    expect(notFound.message).toContain('agent_123');

    const sessionNotFound = new AgentSessionNotFoundError('sess_456');
    expect(sessionNotFound.code).toBe('AGENT_SESSION_NOT_FOUND');
    expect(sessionNotFound.name).toBe('AgentSessionNotFoundError');

    const capError = new AgentCapabilityError('Missing cap', ['IMPACT_QUERY']);
    expect(capError.code).toBe('AGENT_UNSUPPORTED_CAPABILITY');
    expect(capError.requiredCapabilities).toEqual(['IMPACT_QUERY']);

    const scopeError = new AgentScopeError('Scope violation', { ws: 'invalid' });
    expect(scopeError.code).toBe('AGENT_SCOPE_VIOLATION');

    const opError = new AgentOperationError('Op failed', 'GET_CONTEXT');
    expect(opError.code).toBe('AGENT_OPERATION_ERROR');

    const protoError = new AgentProtocolError('Malformed envelope');
    expect(protoError.code).toBe('AGENT_PROTOCOL_ERROR');

    const valError = new AgentValidationError('Validation failed');
    expect(valError.code).toBe('AGENT_VALIDATION_ERROR');

    const verError = new AgentVersionError('Version mismatch', { version: '0.9' });
    expect(verError.code).toBe('AGENT_VERSION_MISMATCH');

    const timeError = new AgentTimeoutError('Request timed out', { timeoutMs: 5000 });
    expect(timeError.code).toBe('AGENT_TIMEOUT');

    const conflictError = new AgentConflictError('Already registered', { agentId: 'a1' });
    expect(conflictError.code).toBe('AGENT_CONFLICT');
  });

  it('serializes cleanly via toJSON()', () => {
    const error = new AgentError('Base error test', 'CUSTOM_CODE', { detailA: 123 });
    const json = error.toJSON();

    expect(json).toEqual({
      name: 'AgentError',
      code: 'CUSTOM_CODE',
      message: 'Base error test',
      details: { detailA: 123 },
    });
  });
});
