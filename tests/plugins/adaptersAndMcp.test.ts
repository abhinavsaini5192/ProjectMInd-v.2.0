import { describe, it, expect, vi } from 'vitest';
import { InMemoryPluginStore } from '../../src/plugins/services/InMemoryPluginStore.js';
import { PluginRegistry } from '../../src/plugins/services/PluginRegistry.js';
import { PluginLifecycleManager } from '../../src/plugins/services/PluginLifecycleManager.js';
import { PluginSecurityPolicyEngine } from '../../src/plugins/services/PluginSecurityPolicyEngine.js';
import { PluginExecutionManager } from '../../src/plugins/services/PluginExecutionManager.js';
import { PluginService } from '../../src/plugins/services/PluginService.js';
import { normalizePluginManifest } from '../../src/plugins/models/PluginManifest.js';
import { PluginContextProviderAdapter } from '../../src/plugins/integrations/PluginContextProviderAdapter.js';
import { PluginRetrievalProviderAdapter } from '../../src/plugins/integrations/PluginRetrievalProviderAdapter.js';
import { PluginToolProviderAdapter } from '../../src/plugins/integrations/PluginToolProviderAdapter.js';
import { PluginVerificationProviderAdapter } from '../../src/plugins/integrations/PluginVerificationProviderAdapter.js';
import { PluginLearningAdapter } from '../../src/plugins/integrations/PluginLearningAdapter.js';
import { AgentToolRegistry } from '../../src/agent/protocol/registry/AgentToolRegistry.js';
import type { IPlugin } from '../../src/plugins/interfaces/IPlugin.js';
import type { IFeedbackCollector } from '../../src/intelligence/learning/interfaces/IFeedbackCollector.js';
import { PluginSecurityError } from '../../src/plugins/errors/PluginError.js';

describe('Phase 9.8 — Plugin Integration Adapters and MCP Compatibility', () => {
  const store = new InMemoryPluginStore();
  const sec = new PluginSecurityPolicyEngine(store);
  const exec = new PluginExecutionManager(store);
  const reg = new PluginRegistry(store);
  const life = new PluginLifecycleManager(store, exec, sec);
  const service = new PluginService(store, reg, life, sec, exec);

  const toolRegistry = new AgentToolRegistry();

  it('26. should adapt CONTEXT_PROVIDER plugin to supply context items', async () => {
    const pluginId = 'context-plugin';
    await reg.registerPlugin(
      normalizePluginManifest({
        pluginId,
        name: 'Context Contributor',
        version: '1.0.0',
        pluginType: 'CONTEXT_PROVIDER',
        declaredCapabilities: ['PROVIDE_CONTEXT'],
      })
    );
    await life.install(pluginId, 'ws-adapters');
    await sec.grantPermissions({
      grantId: 'g-ctx',
      pluginId,
      workspaceId: 'ws-adapters',
      grantedCapabilities: ['PROVIDE_CONTEXT'],
      grantedPermissions: ['*'],
      approvedBy: 'admin',
      approvedAt: new Date().toISOString(),
      status: 'ACTIVE',
    });
    await life.enable(pluginId, 'ws-adapters');

    const pluginInstance: IPlugin = {
      id: pluginId,
      name: 'Context Contributor',
      version: '1.0.0',
      initialize: vi.fn(async () => {}),
      invoke: vi.fn(async () => ({
        success: true,
        data: [
          {
            uri: 'file:///src/models/auth.ts',
            content: 'export interface AuthToken { id: string }',
            relevanceScore: 0.95,
            reason: 'High auth relevance',
          },
        ],
        durationMs: 5,
        correlationId: 'c',
      })),
    };
    exec.registerInstance(pluginId, pluginInstance);

    const adapter = new PluginContextProviderAdapter(service);
    const items = await adapter.provideContext(pluginId, 'auth models', 'ws-adapters');

    expect(items).toHaveLength(1);
    expect(items[0].uri).toBe('file:///src/models/auth.ts');
    expect(items[0].relevanceScore).toBe(0.95);
    expect(items[0].sourcePlugin).toBe(pluginId);
  });

  it('27. should adapt TOOL_PROVIDER plugin and register tools with AgentToolRegistry', async () => {
    const pluginId = 'tool-plugin';
    await reg.registerPlugin(
      normalizePluginManifest({
        pluginId,
        name: 'Tool Contributor',
        version: '1.0.0',
        pluginType: 'TOOL_PROVIDER',
        declaredCapabilities: ['PROVIDE_TOOL'],
      })
    );
    await life.install(pluginId, 'ws-adapters');
    await sec.grantPermissions({
      grantId: 'g-tool',
      pluginId,
      workspaceId: 'ws-adapters',
      grantedCapabilities: ['PROVIDE_TOOL'],
      grantedPermissions: ['*'],
      approvedBy: 'admin',
      approvedAt: new Date().toISOString(),
      status: 'ACTIVE',
    });
    await life.enable(pluginId, 'ws-adapters');

    const pluginInstance: IPlugin = {
      id: pluginId,
      name: 'Tool Contributor',
      version: '1.0.0',
      initialize: vi.fn(async () => {}),
      invoke: vi.fn(async (req) => ({
        success: true,
        data: { queryResult: 'found 4 items for ' + (req.payload as any).query },
        durationMs: 8,
        correlationId: req.correlationId,
      })),
    };
    exec.registerInstance(pluginId, pluginInstance);

    const adapter = new PluginToolProviderAdapter(service, toolRegistry);

    // Register a tool
    const registeredTool = adapter.registerPluginTool(
      pluginId,
      {
        toolName: 'query_db',
        description: 'Queries internal database',
        inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
        outputSchema: { type: 'object' },
      },
      'ws-adapters'
    );

    expect(registeredTool.name).toContain('query_db');
    expect(toolRegistry.getTool(registeredTool.name)).toBeDefined();

    // Execute tool
    const res = await adapter.executePluginTool(pluginId, 'query_db', { query: 'SELECT *' }, 'ws-adapters');
    expect((res as any).queryResult).toContain('found 4 items for SELECT *');
  });

  it('should adapt RETRIEVAL_PROVIDER plugin to contribute search results', async () => {
    const pluginId = 'retrieval-plugin';
    await reg.registerPlugin(
      normalizePluginManifest({
        pluginId,
        name: 'Search Contributor',
        version: '1.0.0',
        pluginType: 'RETRIEVAL_PROVIDER',
        declaredCapabilities: ['PROVIDE_RETRIEVAL'],
      })
    );
    await life.install(pluginId, 'ws-adapters');
    await sec.grantPermissions({
      grantId: 'g-ret',
      pluginId,
      workspaceId: 'ws-adapters',
      grantedCapabilities: ['PROVIDE_RETRIEVAL'],
      grantedPermissions: ['*'],
      approvedBy: 'admin',
      approvedAt: new Date().toISOString(),
      status: 'ACTIVE',
    });
    await life.enable(pluginId, 'ws-adapters');

    const pluginInstance: IPlugin = {
      id: pluginId,
      name: 'Search Contributor',
      version: '1.0.0',
      initialize: vi.fn(async () => {}),
      invoke: vi.fn(async () => ({
        success: true,
        data: [
          {
            id: 'doc-1',
            title: 'API Spec',
            snippet: 'Overview of REST routes',
            score: 0.88,
          },
        ],
        durationMs: 6,
        correlationId: 'c-ret',
      })),
    };
    exec.registerInstance(pluginId, pluginInstance);

    const adapter = new PluginRetrievalProviderAdapter(service);
    const results = await adapter.retrieve(pluginId, 'api routes', 'ws-adapters');

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('API Spec');
    expect(results[0].score).toBe(0.88);
  });

  it('should adapt VERIFICATION_PROVIDER plugin to report verification checks', async () => {
    const pluginId = 'verif-plugin';
    await reg.registerPlugin(
      normalizePluginManifest({
        pluginId,
        name: 'Linter Contributor',
        version: '1.0.0',
        pluginType: 'VERIFICATION_PROVIDER',
        declaredCapabilities: ['REPORT_VERIFICATION'],
      })
    );
    await life.install(pluginId, 'ws-adapters');
    await sec.grantPermissions({
      grantId: 'g-ver',
      pluginId,
      workspaceId: 'ws-adapters',
      grantedCapabilities: ['REPORT_VERIFICATION'],
      grantedPermissions: ['*'],
      approvedBy: 'admin',
      approvedAt: new Date().toISOString(),
      status: 'ACTIVE',
    });
    await life.enable(pluginId, 'ws-adapters');

    const pluginInstance: IPlugin = {
      id: pluginId,
      name: 'Linter Contributor',
      version: '1.0.0',
      initialize: vi.fn(async () => {}),
      invoke: vi.fn(async () => ({
        success: true,
        data: {
          checkName: 'custom-eslint-rule',
          passed: true,
          errors: [],
        },
        durationMs: 12,
        correlationId: 'c-ver',
      })),
    };
    exec.registerInstance(pluginId, pluginInstance);

    const adapter = new PluginVerificationProviderAdapter(service);
    const check = await adapter.runVerification(pluginId, 'src/auth.ts', 'ws-adapters');

    expect(check.passed).toBe(true);
    expect(check.checkName).toBe('custom-eslint-rule');
  });

  it('should adapt Learning Intelligence and prevent privilege escalation', async () => {
    const mockCollector: IFeedbackCollector = {
      recordFeedback: vi.fn(async (params) => ({
        id: 'fb-generated-123',
        ...params,
      } as any)),
      recordContextFeedback: vi.fn(async () => []),
      recordRetrievalFeedback: vi.fn(async () => []),
      recordPlanningFeedback: vi.fn(async () => ({} as any)),
      recordVerificationFeedback: vi.fn(async () => ({} as any)),
      recordUserFeedback: vi.fn(async () => ({} as any)),
    };

    const pluginId = 'feedback-plugin';
    await reg.registerPlugin(
      normalizePluginManifest({
        pluginId,
        name: 'Feedback Contributor',
        version: '1.0.0',
        declaredCapabilities: ['SUBMIT_FEEDBACK'],
      })
    );
    await life.install(pluginId, 'ws-adapters');
    await sec.grantPermissions({
      grantId: 'g-fb',
      pluginId,
      workspaceId: 'ws-adapters',
      grantedCapabilities: ['SUBMIT_FEEDBACK'],
      grantedPermissions: ['*'],
      approvedBy: 'admin',
      approvedAt: new Date().toISOString(),
      status: 'ACTIVE',
    });

    const adapter = new PluginLearningAdapter(service, mockCollector);
    const feedbackId = await adapter.submitPluginFeedback({
      pluginId,
      workspaceId: 'ws-adapters',
      feedbackType: 'CONTEXT_USEFUL',
      targetType: 'FILE',
      targetId: 'src/main.ts',
      signal: 'POSITIVE',
      value: 1.0,
      commentary: 'Useful file in compilation',
    });

    expect(feedbackId).toBe('fb-generated-123');
    expect(mockCollector.recordFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: 'AGENT', // Enforces AGENT, never USER
        sourceId: 'plugin:feedback-plugin',
        confidence: 0.60, // Enforces clamped confidence
      })
    );
  });

  it('should block plugin feedback submission if SUBMIT_FEEDBACK capability is absent', async () => {
    const mockCollector: IFeedbackCollector = {
      recordFeedback: vi.fn(),
      recordContextFeedback: vi.fn(),
      recordRetrievalFeedback: vi.fn(),
      recordPlanningFeedback: vi.fn(),
      recordVerificationFeedback: vi.fn(),
      recordUserFeedback: vi.fn(),
    };

    const pluginId = 'unauthorized-fb-plugin';
    await reg.registerPlugin(
      normalizePluginManifest({
        pluginId,
        name: 'No FB Contributor',
        version: '1.0.0',
      })
    );
    await life.install(pluginId, 'ws-adapters');
    await sec.grantPermissions({
      grantId: 'g-no-fb',
      pluginId,
      workspaceId: 'ws-adapters',
      grantedCapabilities: ['PROVIDE_CONTEXT'], // Missing SUBMIT_FEEDBACK
      grantedPermissions: ['*'],
      approvedBy: 'admin',
      approvedAt: new Date().toISOString(),
      status: 'ACTIVE',
    });

    const adapter = new PluginLearningAdapter(service, mockCollector);
    await expect(
      adapter.submitPluginFeedback({
        pluginId,
        workspaceId: 'ws-adapters',
        feedbackType: 'CONTEXT_USEFUL',
        targetType: 'FILE',
        targetId: 'src/main.ts',
        signal: 'POSITIVE',
        value: 1.0,
      })
    ).rejects.toThrow(PluginSecurityError);
  });
});
