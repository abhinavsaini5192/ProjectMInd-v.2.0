import type { PluginInstallation } from '../models/PluginInstallation.js';
import type { PluginState } from '../models/PluginState.js';
import type { IPlugin } from './IPlugin.js';

export interface IPluginLifecycleManager {
  install(
    pluginId: string,
    workspaceId: string,
    projectId?: string,
    installedBy?: string
  ): Promise<PluginInstallation>;

  initialize(
    pluginId: string,
    instance: IPlugin,
    workspaceId: string,
    projectId?: string
  ): Promise<void>;

  enable(
    pluginId: string,
    workspaceId: string,
    projectId?: string,
    approvedBy?: string
  ): Promise<PluginInstallation>;

  disable(
    pluginId: string,
    workspaceId: string,
    projectId?: string,
    reason?: string
  ): Promise<PluginInstallation>;

  uninstall(
    pluginId: string,
    workspaceId: string,
    projectId?: string
  ): Promise<boolean>;

  getPluginState(
    pluginId: string,
    workspaceId: string,
    projectId?: string
  ): Promise<PluginState>;
}
