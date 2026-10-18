import { describe, it, expect, beforeEach } from 'vitest';
import { AgentSessionMapper } from '../../../src/agent/adapters/core/AgentSessionMapper.js';

describe('AgentSessionMapper Unit Tests', () => {
  let mapper: AgentSessionMapper;

  beforeEach(() => {
    mapper = new AgentSessionMapper();
  });

  it('links provider session ID with canonical session ID bi-directionally', () => {
    const session = mapper.linkSession('ext_session_100', 'canon_session_500', {
      adapterId: 'claude_adapter',
      provider: 'CLAUDE_CODE',
      protocol: 'CLI',
      workspaceId: 'ws_main',
      repositoryId: 'repo_main',
    });

    expect(session.providerSessionId).toBe('ext_session_100');
    expect(session.canonicalSessionId).toBe('canon_session_500');
    expect(session.adapterId).toBe('claude_adapter');
    expect(session.provider).toBe('CLAUDE_CODE');

    expect(mapper.getCanonicalSessionId('ext_session_100')).toBe('canon_session_500');
    expect(mapper.getProviderSessionId('canon_session_500')).toBe('ext_session_100');
  });

  it('maps an existing provider session idempotently to the same canonical session', () => {
    const session1 = mapper.mapSession('cursor_tab_42');
    const canonical1 = session1.canonicalSessionId;

    const session2 = mapper.mapSession('cursor_tab_42');
    expect(session2.canonicalSessionId).toBe(canonical1);
    expect(session2).toBe(session1);
  });

  it('unlinks sessions properly when provider session closes', () => {
    mapper.linkSession('session_a', 'canon_a');
    expect(mapper.getCanonicalSessionId('session_a')).toBe('canon_a');

    const unlinked = mapper.unlinkSession('session_a');
    expect(unlinked).toBe(true);

    expect(mapper.getCanonicalSessionId('session_a')).toBeUndefined();
    expect(mapper.getProviderSessionId('canon_a')).toBeUndefined();
  });

  it('clears all mapped sessions cleanly', () => {
    mapper.linkSession('s1', 'c1');
    mapper.linkSession('s2', 'c2');
    mapper.clear();

    expect(mapper.getCanonicalSessionId('s1')).toBeUndefined();
    expect(mapper.getCanonicalSessionId('s2')).toBeUndefined();
  });
});
