import { describe, it, expect } from 'vitest';
import { AgentCapabilitySet } from '../../src/agent/models/AgentCapabilitySet.js';
import { AgentCapabilityResolver } from '../../src/agent/runtime/AgentCapabilityResolver.js';
import { AgentCapabilityError } from '../../src/agent/errors/AgentCapabilityError.js';
import type { Agent } from '../../src/agent/models/Agent.js';
import type { AgentSession } from '../../src/agent/models/AgentSession.js';

describe('Agent Capabilities & CapabilityResolver', () => {
  describe('AgentCapabilitySet', () => {
    it('performs basic set operations accurately', () => {
      const set = new AgentCapabilitySet(['CONTEXT_REQUEST', 'FEATURE_QUERY']);
      expect(set.has('CONTEXT_REQUEST')).toBe(true);
      expect(set.has('FEATURE_QUERY')).toBe(true);
      expect(set.has('KNOWLEDGE_UPDATE')).toBe(false);

      expect(set.hasAll(['CONTEXT_REQUEST', 'FEATURE_QUERY'])).toBe(true);
      expect(set.hasAll(['CONTEXT_REQUEST', 'IMPACT_QUERY'])).toBe(false);

      expect(set.hasAny(['IMPACT_QUERY', 'CONTEXT_REQUEST'])).toBe(true);
      expect(set.hasAny(['IMPACT_QUERY', 'ARCHITECTURE_QUERY'])).toBe(false);

      set.add('IMPACT_QUERY');
      expect(set.has('IMPACT_QUERY')).toBe(true);

      set.remove('FEATURE_QUERY');
      expect(set.has('FEATURE_QUERY')).toBe(false);
    });

    it('computes intersection correctly', () => {
      const setA = new AgentCapabilitySet(['CONTEXT_REQUEST', 'FEATURE_QUERY', 'HEALTH_QUERY']);
      const setB = new AgentCapabilitySet(['FEATURE_QUERY', 'HEALTH_QUERY', 'KNOWLEDGE_UPDATE']);

      const common = setA.intersection(setB);
      expect(common.toArray()).toEqual(expect.arrayContaining(['FEATURE_QUERY', 'HEALTH_QUERY']));
      expect(common.has('CONTEXT_REQUEST')).toBe(false);
      expect(common.has('KNOWLEDGE_UPDATE')).toBe(false);
    });

    it('validates required capabilities and reports missing ones', () => {
      const set = new AgentCapabilitySet(['CONTEXT_REQUEST']);
      const result = set.validateRequired(['CONTEXT_REQUEST', 'IMPACT_QUERY', 'HISTORY_QUERY']);

      expect(result.satisfied).toBe(false);
      expect(result.missing).toEqual(['IMPACT_QUERY', 'HISTORY_QUERY']);
    });

    it('clones cleanly into an independent instance', () => {
      const original = new AgentCapabilitySet(['CONTEXT_REQUEST']);
      const clone = original.clone();
      clone.add('HEALTH_QUERY');

      expect(original.has('HEALTH_QUERY')).toBe(false);
      expect(clone.has('HEALTH_QUERY')).toBe(true);
    });
  });

  describe('AgentCapabilityResolver', () => {
    const resolver = new AgentCapabilityResolver();

    const baseAgent: Agent = {
      agentId: 'agent_resolver',
      name: 'Resolver Agent',
      type: 'CODING_AGENT',
      version: '1.0',
      status: 'ACTIVE',
      trustLevel: 'LIMITED',
      capabilities: new AgentCapabilitySet(['CONTEXT_REQUEST', 'FEATURE_QUERY']),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('resolves effective capabilities when requested subset is provided', () => {
      const effective = resolver.resolveEffectiveCapabilities(baseAgent, ['CONTEXT_REQUEST']);
      expect(effective.has('CONTEXT_REQUEST')).toBe(true);
      expect(effective.has('FEATURE_QUERY')).toBe(false);
    });

    it('permits operation when agent satisfies required capabilities', () => {
      expect(() =>
        resolver.assertCanPerform(baseAgent, undefined, 'GET_CONTEXT', ['CONTEXT_REQUEST'])
      ).not.toThrow();
    });

    it('throws AgentCapabilityError when agent lacks required capability', () => {
      expect(() =>
        resolver.assertCanPerform(baseAgent, undefined, 'GET_IMPACT', ['IMPACT_QUERY'])
      ).toThrow(AgentCapabilityError);
    });

    it('throws AgentCapabilityError when active session lacks required capability', () => {
      const session: AgentSession = {
        sessionId: 'sess_limited',
        agentId: baseAgent.agentId,
        workspaceId: 'ws_1',
        repositoryId: 'repo_1',
        status: 'ACTIVE',
        capabilities: new AgentCapabilitySet(['CONTEXT_REQUEST']), // lacked FEATURE_QUERY
        protocolVersion: '1.0',
        createdAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
      };

      expect(() =>
        resolver.assertCanPerform(baseAgent, session, 'GET_FEATURE', ['FEATURE_QUERY'])
      ).toThrow(AgentCapabilityError);
    });
  });
});
