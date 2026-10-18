import { describe, it, expect, beforeEach } from 'vitest';
import { AgentTrustModel } from '../../src/agent/architecture/AgentTrustModel.js';
import { AgentScopeError } from '../../src/agent/errors/AgentScopeError.js';
import { createTestSetup, createTestRequest, createAllCapabilities } from './AgentTestHelper.js';
import type { AgentRuntime } from '../../src/agent/runtime/AgentRuntime.js';

describe('Agent Security & Trust Model', () => {
  describe('AgentTrustModel rules', () => {
    it('enforces UNTRUSTED limitations', () => {
      expect(AgentTrustModel.isOperationAllowed('UNTRUSTED', 'GET_CONTEXT')).toBe(true);
      expect(AgentTrustModel.isOperationAllowed('UNTRUSTED', 'GET_FEATURE')).toBe(true);
      expect(AgentTrustModel.isOperationAllowed('UNTRUSTED', 'EXPLAIN_CONTEXT')).toBe(true);
      expect(AgentTrustModel.isOperationAllowed('UNTRUSTED', 'GET_IMPACT')).toBe(false);
      expect(AgentTrustModel.isOperationAllowed('UNTRUSTED', 'REFRESH_CONTEXT')).toBe(false);
      expect(AgentTrustModel.isOperationAllowed('UNTRUSTED', 'UPDATE_KNOWLEDGE')).toBe(false);
    });

    it('enforces LIMITED limitations', () => {
      expect(AgentTrustModel.isOperationAllowed('LIMITED', 'GET_CONTEXT')).toBe(true);
      expect(AgentTrustModel.isOperationAllowed('LIMITED', 'GET_IMPACT')).toBe(true);
      expect(AgentTrustModel.isOperationAllowed('LIMITED', 'GET_ARCHITECTURE')).toBe(true);
      expect(AgentTrustModel.isOperationAllowed('LIMITED', 'REFRESH_CONTEXT')).toBe(false);
      expect(AgentTrustModel.isOperationAllowed('LIMITED', 'UPDATE_KNOWLEDGE')).toBe(false);
    });

    it('enforces TRUSTED allowances and restrictions', () => {
      expect(AgentTrustModel.isOperationAllowed('TRUSTED', 'REFRESH_CONTEXT')).toBe(true);
      expect(AgentTrustModel.isOperationAllowed('TRUSTED', 'REPORT_EXECUTION')).toBe(true);
      expect(AgentTrustModel.isOperationAllowed('TRUSTED', 'REPORT_VERIFICATION')).toBe(true);
      expect(AgentTrustModel.isOperationAllowed('TRUSTED', 'UPDATE_KNOWLEDGE')).toBe(false);
    });

    it('permits all operations for SYSTEM trust level', () => {
      expect(AgentTrustModel.isOperationAllowed('SYSTEM', 'UPDATE_KNOWLEDGE')).toBe(true);
      expect(AgentTrustModel.isOperationAllowed('SYSTEM', 'REFRESH_CONTEXT')).toBe(true);
    });

    it('throws AgentScopeError when assertAllowed fails', () => {
      expect(() =>
        AgentTrustModel.assertAllowed('UNTRUSTED', 'GET_IMPACT', 'untrusted_agent')
      ).toThrow(AgentScopeError);
    });
  });

  describe('Runtime security enforcement', () => {
    let runtime: AgentRuntime;

    beforeEach(() => {
      const setup = createTestSetup();
      runtime = setup.runtime;
    });

    it('blocks UNTRUSTED agent attempting to query impact', async () => {
      await runtime.registerAgent({
        agentId: 'agent_untrusted',
        name: 'Untrusted Agent',
        type: 'CUSTOM_AGENT',
        version: '1.0',
        trustLevel: 'UNTRUSTED',
        capabilities: createAllCapabilities(),
      });

      const request = createTestRequest('GET_IMPACT', { featureId: 'feat_x' }, {
        agentId: 'agent_untrusted',
      });

      const response = await runtime.executeOperation(request);
      expect(response.status).toBe('ERROR');
      expect(response.error?.code).toBe('AGENT_SCOPE_VIOLATION');
    });

    it('blocks LIMITED agent attempting to update knowledge', async () => {
      await runtime.registerAgent({
        agentId: 'agent_limited',
        name: 'Limited Agent',
        type: 'CUSTOM_AGENT',
        version: '1.0',
        trustLevel: 'LIMITED',
        capabilities: createAllCapabilities(),
      });

      const request = createTestRequest('UPDATE_KNOWLEDGE', {
        knowledgeType: 'NOTE',
        payload: {},
      }, {
        agentId: 'agent_limited',
      });

      const response = await runtime.executeOperation(request);
      expect(response.status).toBe('ERROR');
      expect(response.error?.code).toBe('AGENT_SCOPE_VIOLATION');
    });
  });
});
