import { describe, it, expect, vi } from 'vitest';
import { InMemoryPluginStore } from '../../src/plugins/services/InMemoryPluginStore.js';
import { PluginRegistry } from '../../src/plugins/services/PluginRegistry.js';
import { PluginLifecycleManager } from '../../src/plugins/services/PluginLifecycleManager.js';
import { PluginSecurityPolicyEngine } from '../../src/plugins/services/PluginSecurityPolicyEngine.js';
import { PluginExecutionManager } from '../../src/plugins/services/PluginExecutionManager.js';
import { normalizePluginManifest } from '../../src/plugins/models/PluginManifest.js';
import type { IPlugin } from '../../src/plugins/interfaces/IPlugin.js';
import { PluginError, PluginLifecycleError, PluginDependencyError } from '../../src/plugins/errors/PluginError.js';
import type { IEventBus } from '../../src/workspace/interfaces/IEventBus.js';

type EventPayload = { type?: string; [key: string]: unknown };

describe('Phase 9.8 — Plugin Registry and Lifecycle', () => {
  const publishedEvents: EventPayload[] = [];
  const mockEventBus: any = {
    publish: vi.fn(async (first: any, second?: any) => {
      const event = second !== undefined ? second : first;
      publishedEvents.push(event);
    }),
    subscribe: vi.fn(() => () => {}),
    getHistory: vi.fn(() => publishedEvents),
    clearHistory: vi.fn(() => {
      publishedEvents.length = 0;
    }),
  };

  const createSystem = () => {
    const store = new InMemoryPluginStore();
    const sec = new PluginSecurityPolicyEngine(store);
    const exec = new PluginExecutionManager(store);
    const reg = new PluginRegistry(store, mockEventBus);
    const life = new PluginLifecycleManager(store, exec, sec, mockEventBus);
    return { store, sec, exec, reg, life };
  };

  it('4. should reject duplicate plugin registration', async () => {
    const { reg } = createSystem();
    const manifest = normalizePluginManifest({
      pluginId: 'test-plugin',
      name: 'Test Plugin',
      version: '1.0.0',
    });

    await reg.registerPlugin(manifest);
    await expect(reg.registerPlugin(manifest)).rejects.toThrow(/already registered/);
  });

  it('10. should validate legal state transitions and reject illegal transitions', async () => {
    const { reg, life } = createSystem();
    const manifest = normalizePluginManifest({
      pluginId: 'state-plugin',
      name: 'State Plugin',
      version: '1.0.0',
    });
    await reg.registerPlugin(manifest);

    // Install
    const inst = await life.install('state-plugin', 'ws-1');
    expect(inst.state).toBe('INSTALLED');

    // Attempting to disable a plugin that is INSTALLED (not enabled) is illegal
    await expect(life.disable('state-plugin', 'ws-1')).rejects.toThrow(PluginLifecycleError);
  });

  it('11. should enable and disable a plugin cleanly with permission grant', async () => {
    const { reg, sec, life } = createSystem();
    const manifest = normalizePluginManifest({
      pluginId: 'lifecycle-plugin',
      name: 'Lifecycle Plugin',
      version: '1.0.0',
    });
    await reg.registerPlugin(manifest);
    await life.install('lifecycle-plugin', 'ws-1');

    // Grant permission
    await sec.grantPermissions({
      grantId: 'grant-1',
      pluginId: 'lifecycle-plugin',
      workspaceId: 'ws-1',
      grantedCapabilities: ['PROVIDE_CONTEXT'],
      grantedPermissions: ['READ:CONTEXT'],
      approvedBy: 'admin',
      approvedAt: new Date().toISOString(),
      status: 'ACTIVE',
    });

    const enabled = await life.enable('lifecycle-plugin', 'ws-1');
    expect(enabled.state).toBe('ENABLED');
    expect(enabled.enabled).toBe(true);

    const disabled = await life.disable('lifecycle-plugin', 'ws-1');
    expect(disabled.state).toBe('DISABLED');
    expect(disabled.enabled).toBe(false);
  });

  it('12. should handle failed plugin initialization and isolate failure state', async () => {
    const { reg, life } = createSystem();
    const manifest = normalizePluginManifest({
      pluginId: 'failing-init-plugin',
      name: 'Failing Init Plugin',
      version: '1.0.0',
    });
    await reg.registerPlugin(manifest);

    const failingPlugin: IPlugin = {
      id: 'failing-init-plugin',
      name: 'Failing',
      version: '1.0.0',
      initialize: vi.fn(async () => {
        throw new Error('Config file corrupted');
      }),
      invoke: vi.fn(),
    };

    await expect(life.initialize('failing-init-plugin', failingPlugin, 'ws-1')).rejects.toThrow(
      PluginLifecycleError
    );

    const state = await life.getPluginState('failing-init-plugin', 'ws-1');
    expect(state).toBe('FAILED');
  });

  it('13. should execute graceful shutdown across all instances', async () => {
    const { exec } = createSystem();
    const shutdownSpy = vi.fn(async () => {});

    const plugin: IPlugin = {
      id: 'clean-plugin',
      name: 'Clean Plugin',
      version: '1.0.0',
      initialize: vi.fn(async () => {}),
      shutdown: shutdownSpy,
      invoke: vi.fn(),
    };

    exec.registerInstance('clean-plugin', plugin);
    await exec.shutdownAll();

    expect(shutdownSpy).toHaveBeenCalledOnce();
    expect(exec.getInstance('clean-plugin')).toBeUndefined();
  });

  it('28. should handle concurrent lifecycle operations safely', async () => {
    const { reg, life, sec } = createSystem();
    const manifest = normalizePluginManifest({
      pluginId: 'concurrent-plugin',
      name: 'Concurrent Plugin',
      version: '1.0.0',
    });
    await reg.registerPlugin(manifest);

    // Concurrent install calls
    const [inst1, inst2] = await Promise.all([
      life.install('concurrent-plugin', 'ws-1'),
      life.install('concurrent-plugin', 'ws-1'),
    ]);

    expect(inst1.installationId).toBe(inst2.installationId);
  });

  it('29. should enforce dependency checks and block disablement if dependent plugin exists', async () => {
    const { reg, life, sec } = createSystem();
    // Plugin A (Base)
    await reg.registerPlugin(
      normalizePluginManifest({
        pluginId: 'plugin-base',
        name: 'Base Plugin',
        version: '1.0.0',
      })
    );
    // Plugin B (Depends on Base)
    await reg.registerPlugin(
      normalizePluginManifest({
        pluginId: 'plugin-dependent',
        name: 'Dependent Plugin',
        version: '1.0.0',
        dependencies: { 'plugin-base': '^1.0.0' },
      })
    );

    await life.install('plugin-base', 'ws-1');
    await life.install('plugin-dependent', 'ws-1');

    await sec.grantPermissions({
      grantId: 'g1',
      pluginId: 'plugin-base',
      workspaceId: 'ws-1',
      grantedCapabilities: ['PROVIDE_CONTEXT'],
      grantedPermissions: ['*'],
      approvedBy: 'admin',
      approvedAt: new Date().toISOString(),
      status: 'ACTIVE',
    });

    await sec.grantPermissions({
      grantId: 'g2',
      pluginId: 'plugin-dependent',
      workspaceId: 'ws-1',
      grantedCapabilities: ['PROVIDE_CONTEXT'],
      grantedPermissions: ['*'],
      approvedBy: 'admin',
      approvedAt: new Date().toISOString(),
      status: 'ACTIVE',
    });

    // Cannot enable dependent plugin if base plugin is not enabled
    await expect(life.enable('plugin-dependent', 'ws-1')).rejects.toThrow(PluginDependencyError);

    // Enable base plugin first
    await life.enable('plugin-base', 'ws-1');
    // Now enable dependent plugin
    await life.enable('plugin-dependent', 'ws-1');

    // Cannot disable base plugin while dependent plugin is still enabled
    await expect(life.disable('plugin-base', 'ws-1')).rejects.toThrow(
      /enabled plugin 'plugin-dependent' depends on it/
    );
  });

  it('33. should emit structured audit events on EventBus', async () => {
    publishedEvents.length = 0;
    const { reg, life } = createSystem();
    const manifest = normalizePluginManifest({
      pluginId: 'audit-plugin',
      name: 'Audit Plugin',
      version: '1.0.0',
    });

    await reg.registerPlugin(manifest);
    await life.install('audit-plugin', 'ws-1');

    expect(publishedEvents.some((e) => e.type === 'plugin.registered')).toBe(true);
    expect(publishedEvents.some((e) => e.type === 'plugin.installed')).toBe(true);
  });

  it('36. should support persistence and state retrieval across operations', async () => {
    const { store, reg } = createSystem();
    const manifest = normalizePluginManifest({
      pluginId: 'persist-plugin',
      name: 'Persist Plugin',
      version: '1.0.0',
    });

    await reg.registerPlugin(manifest);
    const retrieved = await store.getRegistration('persist-plugin');
    expect(retrieved?.pluginId).toBe('persist-plugin');
    expect(retrieved?.descriptor.name).toBe('Persist Plugin');
  });
});
