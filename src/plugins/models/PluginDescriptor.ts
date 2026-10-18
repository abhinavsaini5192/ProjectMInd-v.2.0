import type { PluginType } from './PluginType.js';
import type { PluginCapability } from './PluginCapability.js';

export interface PluginDescriptor {
  readonly pluginId: string;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly publisher: string;
  readonly manifestVersion: string;
  readonly pluginType: PluginType;
  readonly entrypoint: string;
  readonly declaredCapabilities: readonly PluginCapability[];
  readonly requestedPermissions: readonly string[];
  readonly dependencies: Readonly<Record<string, string>>;
  readonly optionalDependencies: Readonly<Record<string, string>>;
  readonly supportedInterfaces: readonly string[];
  readonly integrityChecksum?: string | undefined;
  readonly license?: string | undefined;
  readonly repository?: string | undefined;
}
