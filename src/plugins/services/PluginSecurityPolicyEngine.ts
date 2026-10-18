import type { IPluginSecurityPolicy } from '../interfaces/IPluginSecurityPolicy.js';
import type { IPluginStore } from '../interfaces/IPluginStore.js';
import type { PluginCapability } from '../models/PluginCapability.js';
import type { PluginPermissionGrant } from '../models/PluginPermissionGrant.js';
import type { PluginInvocationRequest } from '../models/PluginInvocation.js';
import { PluginSecurityError } from '../errors/PluginError.js';

export class PluginSecurityPolicyEngine implements IPluginSecurityPolicy {
  constructor(private readonly store: IPluginStore) {}

  public async evaluateInvocation(request: PluginInvocationRequest): Promise<boolean> {
    const grant = await this.store.getGrant(request.pluginId, request.workspaceId, request.projectId);

    if (!grant || grant.status !== 'ACTIVE') {
      throw new PluginSecurityError(
        request.pluginId,
        `Plugin '${request.pluginId}' has no active permission grant in workspace '${request.workspaceId}'.`
      );
    }

    if (request.requiredCapabilities && request.requiredCapabilities.length > 0) {
      const grantedSet = new Set(grant.grantedCapabilities);
      const missing = request.requiredCapabilities.filter((c) => !grantedSet.has(c));
      if (missing.length > 0) {
        throw new PluginSecurityError(
          request.pluginId,
          `Plugin '${request.pluginId}' missing required capabilities: ${missing.join(', ')}`,
          missing
        );
      }
    }

    return true;
  }

  public async hasCapability(
    pluginId: string,
    capability: PluginCapability,
    workspaceId: string,
    projectId?: string
  ): Promise<boolean> {
    const grant = await this.store.getGrant(pluginId, workspaceId, projectId);
    if (!grant || grant.status !== 'ACTIVE') {
      return false;
    }
    return grant.grantedCapabilities.includes(capability);
  }

  public async grantPermissions(grant: PluginPermissionGrant): Promise<void> {
    await this.store.saveGrant(grant);
  }

  public async revokePermissions(
    pluginId: string,
    workspaceId: string,
    projectId?: string
  ): Promise<void> {
    await this.store.revokeGrant(pluginId, workspaceId, projectId);
  }

  public async getEffectiveCapabilities(
    pluginId: string,
    workspaceId: string,
    projectId?: string
  ): Promise<readonly PluginCapability[]> {
    const grant = await this.store.getGrant(pluginId, workspaceId, projectId);
    if (!grant || grant.status !== 'ACTIVE') {
      return [];
    }
    return grant.grantedCapabilities;
  }

  public async getEffectivePermissions(
    pluginId: string,
    workspaceId: string,
    projectId?: string
  ): Promise<readonly string[]> {
    const grant = await this.store.getGrant(pluginId, workspaceId, projectId);
    if (!grant || grant.status !== 'ACTIVE') {
      return [];
    }
    return grant.grantedPermissions;
  }

  /**
   * Redacts sensitive secret strings and keys recursively.
   */
  public static redactSecrets<T>(data: T): T {
    if (data === null || data === undefined) return data;
    if (typeof data === 'string') {
      // Check for token patterns
      if (/^(sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{20,}|bearer\s+[a-zA-Z0-9._-]+)/i.test(data)) {
        return '[REDACTED]' as unknown as T;
      }
      return data;
    }
    if (Array.isArray(data)) {
      return data.map((item) => PluginSecurityPolicyEngine.redactSecrets(item)) as unknown as T;
    }
    if (typeof data === 'object') {
      const copy: Record<string, unknown> = {};
      const secretKeyPattern = /^(password|secret|token|apikey|api_key|auth|private_key)$/i;
      for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
        if (secretKeyPattern.test(key)) {
          copy[key] = '[REDACTED]';
        } else {
          copy[key] = PluginSecurityPolicyEngine.redactSecrets(val);
        }
      }
      return copy as unknown as T;
    }
    return data;
  }
}
