import type { PluginManifest } from '../models/PluginManifest.js';
import type { PluginRegistration } from '../models/PluginRegistration.js';
import type { PluginRegistrationFilter } from './IPluginStore.js';
import type { PluginType } from '../models/PluginType.js';

export interface IPluginRegistry {
  registerPlugin(
    manifest: PluginManifest,
    options?: {
      readonly registeredBy?: string | undefined;
      readonly source?: 'LOCAL' | 'REMOTE' | 'BUILTIN' | 'PACKAGE' | undefined;
      readonly packageUri?: string | undefined;
      readonly checksum?: string | undefined;
    }
  ): Promise<PluginRegistration>;

  getPlugin(pluginId: string): Promise<PluginRegistration | undefined>;
  listPlugins(filter?: PluginRegistrationFilter): Promise<PluginRegistration[]>;
  unregisterPlugin(pluginId: string): Promise<boolean>;
  resolveExtensionType(pluginType: PluginType): Promise<PluginRegistration[]>;
  isPluginRegistered(pluginId: string): Promise<boolean>;
}
