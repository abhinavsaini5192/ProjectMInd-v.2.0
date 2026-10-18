import { describe, it, expect, vi } from 'vitest';
import { InMemoryPluginStore } from '../../src/plugins/services/InMemoryPluginStore.js';
import { PluginRegistry } from '../../src/plugins/services/PluginRegistry.js';
import { PluginLifecycleManager } from '../../src/plugins/services/PluginLifecycleManager.js';
import { PluginSecurityPolicyEngine } from '../../src/plugins/services/PluginSecurityPolicyEngine.js';
import { PluginExecutionManager } from '../../src/plugins/services/PluginExecutionManager.js';
import { PluginService } from '../../src/plugins/services/PluginService.js';
import { PluginContextProviderAdapter } from '../../src/plugins/integrations/PluginContextProviderAdapter.js';
import type { IPlugin } from '../../src/plugins/interfaces/IPlugin.js';

describe('Phase 9.8 — End-to-End Context Provider Plugin Lifecycle Scenario', () => {
  it('should execute full 15-step context provider lifecycle safely', async () => {
    const store = new InMemoryPluginStore();
    const sec = new PluginSecurityPolicyEngine(store);
    const exec = new PluginExecutionManager(store);
    const reg = new PluginRegistry(store);
    const life = new PluginLifecycleManager(store, exec, sec);
    const service = new PluginService(store, reg, life, sec, exec);

    const workspaceId = 'ws-production';
    const projectId = 'proj-e2e';
    const pluginId = 'org.projectmind.git-context-provider';

    // Step 1 & 2: Developer creates a plugin declaration with supported capabilities
    const manifestRaw = {
      pluginId,
      name: 'Git Context Provider Plugin',
      version: '1.0.0',
      description: 'Supplies git history and branch changes to the context engine.',
      publisher: 'projectmind-ecosystem',
      manifestVersion: '1.0',
      minimumProjectMindVersion: '0.9.0',
      pluginType: 'CONTEXT_PROVIDER',
      entrypoint: 'dist/index.js',
      declaredCapabilities: ['PROVIDE_CONTEXT'],
      requestedPermissions: ['READ:CONTEXT', 'READ:REPOSITORY'],
    };

    // Step 3: ProjectMind validates manifest
    const validatedManifest = service.validateManifest(manifestRaw);
    expect(validatedManifest.pluginId).toBe(pluginId);
    expect(validatedManifest.declaredCapabilities).toContain('PROVIDE_CONTEXT');

    // Step 4: Compatibility is checked
    const compatibility = await service.checkCompatibility(pluginId, '0.9.8').catch(() => null);
    // (Before registration it is not in registry, check with checker)
    const directCompat = service['compatibilityChecker'].checkCompatibility(validatedManifest, '0.9.8');
    expect(directCompat.compatible).toBe(true);

    // Step 5 & 6: Plugin is registered, permissions reviewed/granted, and enabled
    const registration = await service.registerPlugin(manifestRaw, { registeredBy: 'developer-alice' });
    expect(registration.state).toBe('REGISTERED');

    // Install in workspace
    const installation = await service.installPlugin(pluginId, workspaceId, projectId, 'developer-alice');
    expect(installation.state).toBe('INSTALLED');

    // Instantiate plugin instance
    let invokeCounter = 0;
    const testPluginInstance: IPlugin = {
      id: pluginId,
      name: 'Git Context Provider Plugin',
      version: '1.0.0',
      initialize: vi.fn(async () => {}),
      invoke: vi.fn(async (req) => {
        invokeCounter++;
        return {
          success: true,
          data: [
            {
              uri: 'git://commits/latest',
              content: 'Commit 8f192b: Refactored authentication and token verification.',
              relevanceScore: 0.92,
              reason: 'Recent git commit touching auth',
            },
          ],
          durationMs: 8,
          correlationId: req.correlationId,
        };
      }),
    };
    await service.initializePlugin(pluginId, testPluginInstance, workspaceId, projectId);

    // Review and grant permissions
    await service.grantPermissions({
      grantId: 'grant-e2e-approved',
      pluginId,
      workspaceId,
      projectId,
      grantedCapabilities: ['PROVIDE_CONTEXT'],
      grantedPermissions: ['READ:CONTEXT', 'READ:REPOSITORY'],
      approvedBy: 'security-officer-bob',
      approvedAt: new Date().toISOString(),
      status: 'ACTIVE',
    });

    // Enable plugin
    const enabled = await service.enablePlugin(pluginId, workspaceId, projectId, 'security-officer-bob');
    expect(enabled.state).toBe('ENABLED');
    expect(enabled.enabled).toBe(true);

    // Step 7: Authorized agent requests context
    const adapter = new PluginContextProviderAdapter(service);

    // Step 8 & 9: ProjectMind checks effective capabilities/scope & plugin returns structured contribution
    const contextItems = await adapter.provideContext(
      pluginId,
      'auth token refactor',
      workspaceId,
      projectId
    );

    // Step 10 & 11: Validates response and provenance
    expect(contextItems).toHaveLength(1);
    expect(contextItems[0].uri).toBe('git://commits/latest');
    expect(contextItems[0].relevanceScore).toBe(0.92);
    expect(contextItems[0].sourcePlugin).toBe(pluginId);
    expect(invokeCounter).toBe(1);

    // Step 12: Invocation metadata is recorded
    const history = await service.getExecutionHistory(pluginId);
    expect(history.length).toBeGreaterThan(0);
    expect((history[0] as any).status).toBe('SUCCESS');
    expect((history[0] as any).operation).toBe('provideContext');

    // Step 13: Timeout or malformed response is handled safely without crashing
    const malformedPlugin: IPlugin = {
      id: 'malformed-plugin',
      name: 'Bad Plugin',
      version: '1.0.0',
      initialize: vi.fn(async () => {}),
      invoke: vi.fn(async () => {
        throw new Error('Plugin unhandled error');
      }),
    };
    await service.registerPlugin({
      pluginId: 'malformed-plugin',
      name: 'Bad Plugin',
      version: '1.0.0',
      declaredCapabilities: ['PROVIDE_CONTEXT'],
    });
    await service.installPlugin('malformed-plugin', workspaceId, projectId);
    await service.grantPermissions({
      grantId: 'g-bad',
      pluginId: 'malformed-plugin',
      workspaceId,
      projectId,
      grantedCapabilities: ['PROVIDE_CONTEXT'],
      grantedPermissions: ['*'],
      approvedBy: 'admin',
      approvedAt: new Date().toISOString(),
      status: 'ACTIVE',
    });
    await service.initializePlugin('malformed-plugin', malformedPlugin, workspaceId, projectId);
    await service.enablePlugin('malformed-plugin', workspaceId, projectId);

    const badResult = await adapter.provideContext('malformed-plugin', 'test', workspaceId, projectId);
    // Returns empty array, doesn't crash context generation
    expect(badResult).toEqual([]);

    // Step 14: Disabling the plugin prevents subsequent invocation
    await service.disablePlugin(pluginId, workspaceId, projectId, 'Maintenance period');
    const disabledItems = await adapter.provideContext(pluginId, 'query', workspaceId, projectId);
    expect(disabledItems).toEqual([]);

    // Step 15: Unrelated ProjectMind functionality continues working normally
    const otherRegistration = await service.getPlugin('malformed-plugin');
    expect(otherRegistration?.descriptor.name).toBe('Bad Plugin');
  });
});
