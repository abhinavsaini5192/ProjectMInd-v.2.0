import type { IPluginRegistry } from '../interfaces/IPluginRegistry.js';
import type { IPluginStore, PluginRegistrationFilter } from '../interfaces/IPluginStore.js';
import type { PluginManifest } from '../models/PluginManifest.js';
import type { PluginRegistration } from '../models/PluginRegistration.js';
import type { PluginDescriptor } from '../models/PluginDescriptor.js';
import type { PluginType } from '../models/PluginType.js';
import type { IEventBus } from '../../workspace/interfaces/IEventBus.js';
import { PluginEventNames } from '../events/PluginEvents.js';
import { PluginError } from '../errors/PluginError.js';

export class PluginRegistry implements IPluginRegistry {
  constructor(
    private readonly store: IPluginStore,
    private readonly eventBus?: IEventBus
  ) {}

  public async registerPlugin(
    manifest: PluginManifest,
    options?: {
      readonly registeredBy?: string | undefined;
      readonly source?: 'LOCAL' | 'REMOTE' | 'BUILTIN' | 'PACKAGE' | undefined;
      readonly packageUri?: string | undefined;
      readonly checksum?: string | undefined;
    }
  ): Promise<PluginRegistration> {
    const existing = await this.store.getRegistration(manifest.pluginId);
    if (existing) {
      throw new PluginError(
        `Plugin with ID '${manifest.pluginId}' is already registered (v${existing.version}).`,
        'DUPLICATE_PLUGIN_REGISTRATION'
      );
    }

    const descriptor: PluginDescriptor = {
      pluginId: manifest.pluginId,
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      publisher: manifest.publisher,
      manifestVersion: manifest.manifestVersion,
      pluginType: manifest.pluginType,
      entrypoint: manifest.entrypoint,
      declaredCapabilities: manifest.declaredCapabilities,
      requestedPermissions: manifest.requestedPermissions,
      dependencies: manifest.dependencies,
      optionalDependencies: manifest.optionalDependencies,
      supportedInterfaces: manifest.supportedInterfaces,
      integrityChecksum: manifest.integrity?.checksum,
      license: manifest.license,
      repository: manifest.repository,
    };

    const now = new Date().toISOString();
    const registration: PluginRegistration = {
      registrationId: `reg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      pluginId: manifest.pluginId,
      descriptor,
      state: 'REGISTERED',
      registeredAt: now,
      registeredBy: options?.registeredBy ?? 'system',
      version: manifest.version,
      manifestRaw: { ...manifest },
      provenance: {
        source: options?.source ?? 'LOCAL',
        packageUri: options?.packageUri,
        checksum: options?.checksum,
      },
      updatedAt: now,
    };

    await this.store.saveRegistration(registration);

    if (this.eventBus) {
      await this.eventBus.publish(PluginEventNames.PLUGIN_REGISTERED, {
        id: `evt-${Date.now()}`,
        type: PluginEventNames.PLUGIN_REGISTERED,
        timestamp: new Date(),
        senderId: 'PluginRegistry',
        correlationId: registration.registrationId,
        metadata: {
          pluginId: manifest.pluginId,
          version: manifest.version,
          pluginType: manifest.pluginType,
          publisher: manifest.publisher,
        },
      });
    }

    return registration;
  }

  public async getPlugin(pluginId: string): Promise<PluginRegistration | undefined> {
    return this.store.getRegistration(pluginId);
  }

  public async listPlugins(filter?: PluginRegistrationFilter): Promise<PluginRegistration[]> {
    return this.store.listRegistrations(filter);
  }

  public async unregisterPlugin(pluginId: string): Promise<boolean> {
    const existing = await this.store.getRegistration(pluginId);
    if (!existing) return false;

    const removed = await this.store.deleteRegistration(pluginId);
    if (removed && this.eventBus) {
      await this.eventBus.publish(PluginEventNames.PLUGIN_UNINSTALLED, {
        id: `evt-${Date.now()}`,
        type: PluginEventNames.PLUGIN_UNINSTALLED,
        timestamp: new Date(),
        senderId: 'PluginRegistry',
        correlationId: `unreg-${pluginId}`,
        metadata: { pluginId },
      });
    }
    return removed;
  }

  public async resolveExtensionType(pluginType: PluginType): Promise<PluginRegistration[]> {
    return this.store.listRegistrations({ pluginType });
  }

  public async isPluginRegistered(pluginId: string): Promise<boolean> {
    const reg = await this.store.getRegistration(pluginId);
    return reg !== undefined;
  }
}
