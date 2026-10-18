import type { PluginManifest } from '../models/PluginManifest.js';
import type { PluginRegistration } from '../models/PluginRegistration.js';
import type { PluginInstallation } from '../models/PluginInstallation.js';
import type { PluginPermissionGrant } from '../models/PluginPermissionGrant.js';
import type { PluginCompatibilityResult } from '../models/PluginCompatibilityResult.js';
import type { PluginInvocationRequest, PluginInvocationResult } from '../models/PluginInvocation.js';
import type { IPlugin, PluginHealthReport } from './IPlugin.js';
import type { PluginRegistrationFilter, PluginInstallationFilter } from './IPluginStore.js';
import type { PluginType } from '../models/PluginType.js';

export interface IPluginService {
  // Manifest & Compatibility
  validateManifest(rawManifest: unknown): PluginManifest;
  checkCompatibility(pluginId: string, targetVersion?: string): Promise<PluginCompatibilityResult>;

  // Registry
  registerPlugin(manifestRaw: unknown, options?: { registeredBy?: string; source?: 'LOCAL' | 'REMOTE' | 'BUILTIN' | 'PACKAGE' }): Promise<PluginRegistration>;
  getPlugin(pluginId: string): Promise<PluginRegistration | undefined>;
  listPlugins(filter?: PluginRegistrationFilter): Promise<PluginRegistration[]>;
  unregisterPlugin(pluginId: string): Promise<boolean>;
  getPluginsByType(type: PluginType): Promise<PluginRegistration[]>;

  // Lifecycle
  installPlugin(pluginId: string, workspaceId: string, projectId?: string, installedBy?: string): Promise<PluginInstallation>;
  initializePlugin(pluginId: string, instance: IPlugin, workspaceId: string, projectId?: string): Promise<void>;
  enablePlugin(pluginId: string, workspaceId: string, projectId?: string, approvedBy?: string): Promise<PluginInstallation>;
  disablePlugin(pluginId: string, workspaceId: string, projectId?: string, reason?: string): Promise<PluginInstallation>;
  uninstallPlugin(pluginId: string, workspaceId: string, projectId?: string): Promise<boolean>;
  listInstallations(filter: PluginInstallationFilter): Promise<PluginInstallation[]>;

  // Permissions & Security
  grantPermissions(grant: PluginPermissionGrant): Promise<void>;
  revokePermissions(pluginId: string, workspaceId: string, projectId?: string): Promise<void>;
  getGrants(workspaceId: string, projectId?: string): Promise<PluginPermissionGrant[]>;

  // Invocation & Health
  invokePlugin(request: PluginInvocationRequest): Promise<PluginInvocationResult>;
  checkHealth(pluginId: string): Promise<PluginHealthReport>;

  // Configuration
  configurePlugin(pluginId: string, workspaceId: string, config: Record<string, unknown>, projectId?: string): Promise<void>;
  getConfiguration(pluginId: string, workspaceId: string, projectId?: string): Promise<Record<string, unknown> | undefined>;

  // Execution History
  getExecutionHistory(pluginId: string, limit?: number): Promise<unknown[]>;
}
