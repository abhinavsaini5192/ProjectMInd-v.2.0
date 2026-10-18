import { describe, it, expect, beforeEach } from 'vitest';
import { ApiRouter } from '../../src/api/routing/ApiRouter.js';
import { RequestService } from '../../src/api/services/RequestService.js';
import { PluginController } from '../../src/api/controllers/PluginController.js';
import { InMemoryPluginStore } from '../../src/plugins/services/InMemoryPluginStore.js';
import { PluginRegistry } from '../../src/plugins/services/PluginRegistry.js';
import { PluginLifecycleManager } from '../../src/plugins/services/PluginLifecycleManager.js';
import { PluginSecurityPolicyEngine } from '../../src/plugins/services/PluginSecurityPolicyEngine.js';
import { PluginExecutionManager } from '../../src/plugins/services/PluginExecutionManager.js';
import { PluginService } from '../../src/plugins/services/PluginService.js';

describe('Phase 9.8 — PluginController API Suite', () => {
  let router: ApiRouter;
  let requestService: RequestService;
  let pluginService: PluginService;
  let controller: PluginController;

  beforeEach(() => {
    router = new ApiRouter();
    requestService = new RequestService();

    const store = new InMemoryPluginStore();
    const sec = new PluginSecurityPolicyEngine(store);
    const exec = new PluginExecutionManager(store);
    const reg = new PluginRegistry(store);
    const life = new PluginLifecycleManager(store, exec, sec);

    pluginService = new PluginService(store, reg, life, sec, exec);
    controller = new PluginController(pluginService);
    controller.registerRoutes(router);
  });

  it('34. POST /plugins/validate should validate raw manifest', async () => {
    const req = requestService.createRequest({
      path: '/plugins/validate',
      method: 'POST',
      body: {
        pluginId: 'valid-plugin',
        name: 'Valid Plugin',
        version: '1.0.0',
        pluginType: 'CONTEXT_PROVIDER',
      },
    });

    const res = await router.handle(req);
    expect(res.status).toBe(200);
    expect(res.data.pluginId).toBe('valid-plugin');
  });

  it('POST /plugins/register should register a plugin and return 201', async () => {
    const req = requestService.createRequest({
      path: '/plugins/register',
      method: 'POST',
      body: {
        manifest: {
          pluginId: 'registered-plugin',
          name: 'Registered Plugin',
          version: '1.0.0',
          pluginType: 'GENERIC_INTEGRATION',
        },
      },
    });

    const res = await router.handle(req);
    expect(res.status).toBe(201);
    expect(res.data.pluginId).toBe('registered-plugin');
    expect(res.data.state).toBe('REGISTERED');
  });

  it('GET /plugins and GET /plugins/:id should return registered plugin details', async () => {
    await pluginService.registerPlugin({
      pluginId: 'get-plugin',
      name: 'Get Plugin',
      version: '1.0.0',
    });

    // List
    const listReq = requestService.createRequest({ path: '/plugins', method: 'GET' });
    const listRes = await router.handle(listReq);
    expect(listRes.status).toBe(200);
    expect(listRes.data.length).toBeGreaterThan(0);

    // Get
    const getReq = requestService.createRequest({ path: '/plugins/get-plugin', method: 'GET' });
    const getRes = await router.handle(getReq);
    expect(getRes.status).toBe(200);
    expect(getRes.data.pluginId).toBe('get-plugin');
  });

  it('POST /plugins/:id/install, approve, and enable should execute cleanly', async () => {
    await pluginService.registerPlugin({
      pluginId: 'enable-plugin',
      name: 'Enable Plugin',
      version: '1.0.0',
      declaredCapabilities: ['PROVIDE_CONTEXT'],
    });

    // 1. Install
    const installReq = requestService.createRequest({
      path: '/plugins/enable-plugin/install',
      method: 'POST',
      context: { workspaceId: 'ws-api', userId: 'user-1' } as any,
    });
    const installRes = await router.handle(installReq);
    expect(installRes.status).toBe(200);
    expect(installRes.data.state).toBe('INSTALLED');

    // 2. Approve
    const approveReq = requestService.createRequest({
      path: '/plugins/enable-plugin/permissions/approve',
      method: 'POST',
      body: { capabilities: ['PROVIDE_CONTEXT'], permissions: ['*'] },
      context: { workspaceId: 'ws-api', userId: 'user-1' } as any,
    });
    const approveRes = await router.handle(approveReq);
    expect(approveRes.status).toBe(200);
    expect(approveRes.data.approved).toBe(true);

    // 3. Enable
    const enableReq = requestService.createRequest({
      path: '/plugins/enable-plugin/enable',
      method: 'POST',
      context: { workspaceId: 'ws-api', userId: 'user-1' } as any,
    });
    const enableRes = await router.handle(enableReq);
    expect(enableRes.status).toBe(200);
    expect(enableRes.data.state).toBe('ENABLED');
    expect(enableRes.data.enabled).toBe(true);
  });

  it('POST /plugins/:id/configure and GET /plugins/:id/configure should manage settings', async () => {
    await pluginService.registerPlugin({
      pluginId: 'config-plugin',
      name: 'Config Plugin',
      version: '1.0.0',
    });

    const setReq = requestService.createRequest({
      path: '/plugins/config-plugin/configure',
      method: 'POST',
      body: { config: { apiKey: 'test-key', timeout: 5000 } },
      context: { workspaceId: 'ws-api' } as any,
    });
    const setRes = await router.handle(setReq);
    expect(setRes.status).toBe(200);

    const getReq = requestService.createRequest({
      path: '/plugins/config-plugin/configure',
      method: 'GET',
      context: { workspaceId: 'ws-api' } as any,
    });
    const getRes = await router.handle(getReq);
    expect(getRes.status).toBe(200);
    expect(getRes.data.timeout).toBe(5000);
  });

  it('DELETE /plugins/:id should unregister plugin', async () => {
    await pluginService.registerPlugin({
      pluginId: 'delete-plugin',
      name: 'Delete Plugin',
      version: '1.0.0',
    });

    const delReq = requestService.createRequest({
      path: '/plugins/delete-plugin',
      method: 'DELETE',
    });
    const delRes = await router.handle(delReq);
    expect(delRes.status).toBe(200);
    expect(delRes.data.uninstalled).toBe(true);
  });
});
