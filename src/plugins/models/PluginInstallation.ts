import type { PluginState } from './PluginState.js';

export interface PluginInstallation {
  readonly installationId: string;
  readonly pluginId: string;
  readonly workspaceId: string;
  readonly projectId?: string | undefined;
  readonly state: PluginState;
  readonly enabled: boolean;
  readonly installedAt: string;
  readonly installedBy: string;
  readonly configuration?: Record<string, unknown> | undefined;
  readonly effectivePermissions: readonly string[];
  readonly effectiveCapabilities: readonly string[];
  readonly lastError?: string | undefined;
  readonly updatedAt: string;
}
