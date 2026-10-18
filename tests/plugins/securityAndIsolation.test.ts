import { describe, it, expect } from 'vitest';
import { InMemoryPluginStore } from '../../src/plugins/services/InMemoryPluginStore.js';
import { PluginSecurityPolicyEngine } from '../../src/plugins/services/PluginSecurityPolicyEngine.js';
import { PluginSecurityError } from '../../src/plugins/errors/PluginError.js';

describe('Phase 9.8 — Plugin Security, Capability Gating and Isolation', () => {
  const store = new InMemoryPluginStore();
  const sec = new PluginSecurityPolicyEngine(store);

  it('7. should reject invocation if plugin lacks required capability', async () => {
    // Grant capability PROVIDE_CONTEXT only
    await sec.grantPermissions({
      grantId: 'g-sec-1',
      pluginId: 'limited-plugin',
      workspaceId: 'ws-security',
      grantedCapabilities: ['PROVIDE_CONTEXT'],
      grantedPermissions: ['READ:CONTEXT'],
      approvedBy: 'admin',
      approvedAt: new Date().toISOString(),
      status: 'ACTIVE',
    });

    // Attempt operation requiring PROVIDE_TOOL
    await expect(
      sec.evaluateInvocation({
        pluginId: 'limited-plugin',
        operation: 'runTool',
        payload: {},
        workspaceId: 'ws-security',
        correlationId: 'c1',
        requestVersion: '1.0',
        requiredCapabilities: ['PROVIDE_TOOL'],
      })
    ).rejects.toThrow(PluginSecurityError);
  });

  it('8. should reject invocation if no grant exists for plugin', async () => {
    await expect(
      sec.evaluateInvocation({
        pluginId: 'unauthorized-plugin',
        operation: 'runTool',
        payload: {},
        workspaceId: 'ws-security',
        correlationId: 'c2',
        requestVersion: '1.0',
      })
    ).rejects.toThrow(/no active permission grant/);
  });

  it('9. should grant and revoke permissions cleanly', async () => {
    await sec.grantPermissions({
      grantId: 'g-revocable',
      pluginId: 'revocable-plugin',
      workspaceId: 'ws-security',
      grantedCapabilities: ['PROVIDE_CONTEXT'],
      grantedPermissions: ['*'],
      approvedBy: 'admin',
      approvedAt: new Date().toISOString(),
      status: 'ACTIVE',
    });

    expect(await sec.hasCapability('revocable-plugin', 'PROVIDE_CONTEXT', 'ws-security')).toBe(true);

    // Revoke
    await sec.revokePermissions('revocable-plugin', 'ws-security');
    expect(await sec.hasCapability('revocable-plugin', 'PROVIDE_CONTEXT', 'ws-security')).toBe(false);
  });

  it('18. should enforce cross-workspace isolation', async () => {
    // Grant in workspace A
    await sec.grantPermissions({
      grantId: 'g-ws-a',
      pluginId: 'scoped-plugin',
      workspaceId: 'ws-alpha',
      grantedCapabilities: ['PROVIDE_CONTEXT'],
      grantedPermissions: ['*'],
      approvedBy: 'admin',
      approvedAt: new Date().toISOString(),
      status: 'ACTIVE',
    });

    // Check workspace Alpha
    expect(await sec.hasCapability('scoped-plugin', 'PROVIDE_CONTEXT', 'ws-alpha')).toBe(true);

    // Check workspace Beta (should be false)
    expect(await sec.hasCapability('scoped-plugin', 'PROVIDE_CONTEXT', 'ws-beta')).toBe(false);

    // Invocation in workspace Beta must fail
    await expect(
      sec.evaluateInvocation({
        pluginId: 'scoped-plugin',
        operation: 'getContext',
        payload: {},
        workspaceId: 'ws-beta',
        correlationId: 'c-beta',
        requestVersion: '1.0',
      })
    ).rejects.toThrow(PluginSecurityError);
  });

  it('19. should enforce cross-project isolation within workspace', async () => {
    await sec.grantPermissions({
      grantId: 'g-proj-1',
      pluginId: 'proj-scoped-plugin',
      workspaceId: 'ws-alpha',
      projectId: 'proj-1',
      grantedCapabilities: ['PROVIDE_CONTEXT'],
      grantedPermissions: ['*'],
      approvedBy: 'admin',
      approvedAt: new Date().toISOString(),
      status: 'ACTIVE',
    });

    expect(await sec.hasCapability('proj-scoped-plugin', 'PROVIDE_CONTEXT', 'ws-alpha', 'proj-1')).toBe(true);
    expect(await sec.hasCapability('proj-scoped-plugin', 'PROVIDE_CONTEXT', 'ws-alpha', 'proj-2')).toBe(false);
  });

  it('20. should recursively redact sensitive secrets and credentials', () => {
    const rawData = {
      username: 'developer',
      apiKey: 'sk-1234567890abcdef1234567890',
      nested: {
        password: 'super-secret-password',
        token: 'ghp_abcdef1234567890abcdef1234567890',
        normalField: 'public-data',
      },
      list: ['safe', 'sk-abcdef9876543210abcdef9876543210'],
    };

    const redacted = PluginSecurityPolicyEngine.redactSecrets(rawData);

    expect(redacted.apiKey).toBe('[REDACTED]');
    expect(redacted.nested.password).toBe('[REDACTED]');
    expect(redacted.nested.token).toBe('[REDACTED]');
    expect(redacted.nested.normalField).toBe('public-data');
    expect(redacted.list[1]).toBe('[REDACTED]');
  });
});
