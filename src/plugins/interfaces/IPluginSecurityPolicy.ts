import type { PluginCapability } from '../models/PluginCapability.js';
import type { PluginPermissionGrant } from '../models/PluginPermissionGrant.js';
import type { PluginInvocationRequest } from '../models/PluginInvocation.js';

export interface IPluginSecurityPolicy {
  evaluateInvocation(request: PluginInvocationRequest): Promise<boolean>;
  hasCapability(
    pluginId: string,
    capability: PluginCapability,
    workspaceId: string,
    projectId?: string
  ): Promise<boolean>;
  grantPermissions(grant: PluginPermissionGrant): Promise<void>;
  revokePermissions(
    pluginId: string,
    workspaceId: string,
    projectId?: string
  ): Promise<void>;
  getEffectiveCapabilities(
    pluginId: string,
    workspaceId: string,
    projectId?: string
  ): Promise<readonly PluginCapability[]>;
  getEffectivePermissions(
    pluginId: string,
    workspaceId: string,
    projectId?: string
  ): Promise<readonly string[]>;
}
