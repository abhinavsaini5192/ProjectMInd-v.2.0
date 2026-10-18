import type { PluginRegistration } from '../models/PluginRegistration.js';
import type { PluginInstallation } from '../models/PluginInstallation.js';
import type { PluginPermissionGrant } from '../models/PluginPermissionGrant.js';
import type { PluginExecutionRecord } from '../models/PluginExecutionRecord.js';
import type { PluginType } from '../models/PluginType.js';

export interface PluginRegistrationFilter {
  readonly pluginType?: PluginType | undefined;
  readonly publisher?: string | undefined;
  readonly search?: string | undefined;
}

export interface PluginInstallationFilter {
  readonly workspaceId: string;
  readonly projectId?: string | undefined;
  readonly enabledOnly?: boolean | undefined;
}

export interface IPluginStore {
  // Registrations
  saveRegistration(registration: PluginRegistration): Promise<void>;
  getRegistration(pluginId: string): Promise<PluginRegistration | undefined>;
  listRegistrations(filter?: PluginRegistrationFilter): Promise<PluginRegistration[]>;
  deleteRegistration(pluginId: string): Promise<boolean>;

  // Installations
  saveInstallation(installation: PluginInstallation): Promise<void>;
  getInstallation(pluginId: string, workspaceId: string, projectId?: string): Promise<PluginInstallation | undefined>;
  listInstallations(filter: PluginInstallationFilter): Promise<PluginInstallation[]>;
  deleteInstallation(pluginId: string, workspaceId: string, projectId?: string): Promise<boolean>;

  // Permission Grants
  saveGrant(grant: PluginPermissionGrant): Promise<void>;
  getGrant(pluginId: string, workspaceId: string, projectId?: string): Promise<PluginPermissionGrant | undefined>;
  listGrants(workspaceId: string, projectId?: string): Promise<PluginPermissionGrant[]>;
  revokeGrant(pluginId: string, workspaceId: string, projectId?: string): Promise<boolean>;

  // Execution Records
  saveExecutionRecord(record: PluginExecutionRecord): Promise<void>;
  listExecutionRecords(pluginId: string, limit?: number): Promise<PluginExecutionRecord[]>;

  // Configurations
  saveConfiguration(pluginId: string, workspaceId: string, config: Record<string, unknown>, projectId?: string): Promise<void>;
  getConfiguration(pluginId: string, workspaceId: string, projectId?: string): Promise<Record<string, unknown> | undefined>;
}
