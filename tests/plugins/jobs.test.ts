import { describe, it, expect, vi } from 'vitest';
import { PluginCompatibilityJobHandler } from '../../src/plugins/jobs/PluginCompatibilityJobHandler.js';
import { PluginHealthCheckJobHandler } from '../../src/plugins/jobs/PluginHealthCheckJobHandler.js';
import { PluginMaintenanceJobHandler } from '../../src/plugins/jobs/PluginMaintenanceJobHandler.js';
import { InMemoryPluginStore } from '../../src/plugins/services/InMemoryPluginStore.js';
import { PluginRegistry } from '../../src/plugins/services/PluginRegistry.js';
import { PluginLifecycleManager } from '../../src/plugins/services/PluginLifecycleManager.js';
import { PluginSecurityPolicyEngine } from '../../src/plugins/services/PluginSecurityPolicyEngine.js';
import { PluginExecutionManager } from '../../src/plugins/services/PluginExecutionManager.js';
import { PluginService } from '../../src/plugins/services/PluginService.js';
import type { JobExecutionContext } from '../../src/jobs/registry/IJobHandler.js';

describe('Phase 9.8 — Plugin Background Jobs', () => {
  const store = new InMemoryPluginStore();
  const sec = new PluginSecurityPolicyEngine(store);
  const exec = new PluginExecutionManager(store);
  const reg = new PluginRegistry(store);
  const life = new PluginLifecycleManager(store, exec, sec);
  const service = new PluginService(store, reg, life, sec, exec);

  const mockContext: JobExecutionContext = {
    workerId: 'worker-1',
    signal: new AbortController().signal,
    updateProgress: vi.fn(async () => {}),
    log: vi.fn(),
  };

  it('should execute PluginCompatibilityJobHandler cleanly', async () => {
    await service.registerPlugin({
      pluginId: 'job-compat-plugin',
      name: 'Job Compat Plugin',
      version: '1.0.0',
    });

    const handler = new PluginCompatibilityJobHandler(service);
    const result = await handler.execute(
      { id: 'j-1', type: 'PLUGIN_COMPATIBILITY_CHECK', payload: {} } as any,
      mockContext
    );

    expect(result.metrics?.checkedCount).toBe(1);
    expect(mockContext.updateProgress).toHaveBeenCalled();
  });

  it('should execute PluginHealthCheckJobHandler cleanly', async () => {
    const handler = new PluginHealthCheckJobHandler(service);
    const result = await handler.execute(
      { id: 'j-2', type: 'PLUGIN_HEALTH_CHECK', payload: {} } as any,
      mockContext
    );

    expect(result.metrics?.checkedCount).toBe(1);
  });

  it('should execute PluginMaintenanceJobHandler cleanly', async () => {
    const handler = new PluginMaintenanceJobHandler(service);
    const result = await handler.execute(
      { id: 'j-3', type: 'PLUGIN_MAINTENANCE', payload: {} } as any,
      mockContext
    );

    expect(result.metrics?.pluginsMaintained).toBe(1);
    expect((result.output as Record<string, unknown>)?.status).toBe('CLEAN');
  });
});
