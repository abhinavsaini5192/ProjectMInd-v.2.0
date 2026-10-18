import type { PluginDescriptor } from './PluginDescriptor.js';
import type { PluginState } from './PluginState.js';

export interface PluginRegistration {
  readonly registrationId: string;
  readonly pluginId: string;
  readonly descriptor: PluginDescriptor;
  readonly state: PluginState;
  readonly registeredAt: string;
  readonly registeredBy: string;
  readonly version: string;
  readonly manifestRaw: Record<string, unknown>;
  readonly provenance: {
    readonly source: 'LOCAL' | 'REMOTE' | 'BUILTIN' | 'PACKAGE';
    readonly packageUri?: string | undefined;
    readonly checksum?: string | undefined;
  };
  readonly updatedAt: string;
}
