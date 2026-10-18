import type { PluginCapability } from './PluginCapability.js';

export interface PluginPermissionGrant {
  readonly grantId: string;
  readonly pluginId: string;
  readonly workspaceId: string;
  readonly projectId?: string | undefined;
  readonly grantedCapabilities: readonly PluginCapability[];
  readonly grantedPermissions: readonly string[];
  readonly approvedBy: string;
  readonly approvedAt: string;
  readonly revokedAt?: string | undefined;
  readonly status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  readonly reason?: string | undefined;
}
