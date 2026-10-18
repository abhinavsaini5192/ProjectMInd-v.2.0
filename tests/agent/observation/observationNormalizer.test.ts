import { describe, it, expect } from 'vitest';
import { ObservationNormalizer } from '../../../src/agent/observation/normalizers/ObservationNormalizer.js';
import { ObservationValidator } from '../../../src/agent/observation/validators/ObservationValidator.js';

describe('ObservationNormalizer', () => {
  const validator = new ObservationValidator();
  const normalizer = new ObservationNormalizer(validator);

  it('normalizes raw observation with generated id and timestamps', () => {
    const raw = {
      taskId: 'task-1',
      sessionId: 'session-1',
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      source: 'AGENT' as const,
      type: 'COMMAND_EXECUTION' as const,
      summary: 'Executed build command',
      payload: { command: 'npm run build', exitCode: 0 },
    };

    const normalized = normalizer.normalize(raw);

    expect(normalized.observationId).toBeDefined();
    expect(normalized.observationId.startsWith('obs_')).toBe(true);
    expect(normalized.timestamp).toBeDefined();
    expect(normalized.observedAt).toBeDefined();
    expect(normalized.taskId).toBe('task-1');
    expect(normalized.summary).toBe('Executed build command');
    expect(normalized.provenance).toBe('AGENT_REPORTED');
  });

  it('assigns correct provenance according to observation source', () => {
    const agentRaw = {
      taskId: 'task-1',
      sessionId: 'session-1',
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      source: 'AGENT' as const,
      type: 'COMMAND_EXECUTION' as const,
      summary: 'Agent ran command',
    };
    expect(normalizer.normalize(agentRaw).provenance).toBe('AGENT_REPORTED');

    const systemRaw = {
      taskId: 'task-1',
      sessionId: 'session-1',
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      source: 'SYSTEM' as const,
      type: 'COMMAND_EXECUTION' as const,
      summary: 'System observed command',
    };
    expect(normalizer.normalize(systemRaw).provenance).toBe('SYSTEM_OBSERVED');

    const verificationRaw = {
      taskId: 'task-1',
      sessionId: 'session-1',
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      source: 'VERIFICATION' as const,
      type: 'VERIFICATION_RESULT' as const,
      summary: 'Verification runner results',
    };
    expect(normalizer.normalize(verificationRaw).provenance).toBe('SYSTEM_VERIFIED');
  });

  it('sanitizes and redacts secrets in payloads during normalization', () => {
    const rawWithSecret = {
      taskId: 'task-1',
      sessionId: 'session-1',
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      source: 'AGENT' as const,
      type: 'COMMAND_EXECUTION' as const,
      summary: 'Ran curl with API token',
      payload: {
        command: 'curl -H "Authorization: Bearer sk-ant-api03-abcdefghijklmnop" https://api.anthropic.com',
        apiKey: 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890',
      },
    };

    const normalized = normalizer.normalize(rawWithSecret);
    const payload = normalized.payload as any;

    expect(payload.command).toContain('[REDACTED_API_KEY]');
    expect(payload.apiKey).toContain('[REDACTED_GITHUB_TOKEN]');
  });

  it('strips hidden reasoning fields (chainOfThought, internalTokens) from payloads', () => {
    const rawWithCoT = {
      taskId: 'task-1',
      sessionId: 'session-1',
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      source: 'AGENT' as const,
      type: 'AGENT_DECISION' as const,
      summary: 'Decision on refactoring',
      payload: {
        decision: 'Refactor UserService',
        reason: 'Improve modularity',
        chainOfThought: 'Step 1: I think the user wants... Step 2: Secret plan...',
        internalTokens: [102, 304, 506],
        scratchpad: 'Temporary thoughts',
      },
    };

    const normalized = normalizer.normalize(rawWithCoT);
    const payload = normalized.payload as any;

    expect(payload.decision).toBe('Refactor UserService');
    expect(payload.reason).toBe('Improve modularity');
    expect(payload.chainOfThought).toBeUndefined();
    expect(payload.internalTokens).toBeUndefined();
    expect(payload.scratchpad).toBeUndefined();
  });
});
