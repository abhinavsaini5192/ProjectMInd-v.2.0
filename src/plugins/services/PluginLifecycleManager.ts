import type { IPluginLifecycleManager } from '../interfaces/IPluginLifecycleManager.js';
import type { IPluginStore } from '../interfaces/IPluginStore.js';
import type { IPluginExecutionManager } from '../interfaces/IPluginExecutionManager.js';
import type { IPluginSecurityPolicy } from '../interfaces/IPluginSecurityPolicy.js';
import type { IPlugin } from '../interfaces/IPlugin.js';
import type { PluginInstallation } from '../models/PluginInstallation.js';
import type { PluginState } from '../models/PluginState.js';
import type { IEventBus } from '../../workspace/interfaces/IEventBus.js';
import { isValidPluginStateTransition } from '../models/PluginState.js';
import { PluginEventNames } from '../events/PluginEvents.js';
import {
  PluginNotFoundError,
  PluginLifecycleError,
  PluginDependencyError,
  PluginSecurityError,
} from '../errors/PluginError.js';

export class PluginLifecycleManager implements IPluginLifecycleManager {
  private readonly installLocks = new Map<string, Promise<PluginInstallation>>();

  constructor(
    private readonly store: IPluginStore,
    private readonly executionManager: IPluginExecutionManager,
    private readonly securityPolicy: IPluginSecurityPolicy,
    private readonly eventBus?: IEventBus
  ) {}

  public async install(
    pluginId: string,
    workspaceId: string,
    projectId?: string,
    installedBy: string = 'system'
  ): Promise<PluginInstallation> {
    const lockKey = `${workspaceId}:${projectId ?? 'root'}:${pluginId}`;
    const pending = this.installLocks.get(lockKey);
    if (pending) {
      return pending;
    }

    const promise = (async () => {
      try {
        const registration = await this.store.getRegistration(pluginId);
        if (!registration) {
          throw new PluginNotFoundError(pluginId);
        }

        const existing = await this.store.getInstallation(pluginId, workspaceId, projectId);
        if (existing) {
          return existing;
        }

        const now = new Date().toISOString();
        const installation: PluginInstallation = {
          installationId: `inst-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          pluginId,
          workspaceId,
          projectId,
          state: 'INSTALLED',
          enabled: false,
          installedAt: now,
          installedBy,
          effectivePermissions: registration.descriptor.requestedPermissions,
          effectiveCapabilities: registration.descriptor.declaredCapabilities,
          updatedAt: now,
        };

        await this.store.saveInstallation(installation);

        if (this.eventBus) {
          await this.eventBus.publish(PluginEventNames.PLUGIN_INSTALLED, {
            id: `evt-${Date.now()}`,
            type: PluginEventNames.PLUGIN_INSTALLED,
            timestamp: new Date(),
            senderId: 'PluginLifecycleManager',
            correlationId: installation.installationId,
            metadata: { pluginId, workspaceId, projectId },
          });
        }

        return installation;
      } finally {
        this.installLocks.delete(lockKey);
      }
    })();

    this.installLocks.set(lockKey, promise);
    return promise;
  }

  public async initialize(
    pluginId: string,
    instance: IPlugin,
    workspaceId: string,
    projectId?: string
  ): Promise<void> {
    let installation = await this.store.getInstallation(pluginId, workspaceId, projectId);
    if (!installation) {
      installation = await this.install(pluginId, workspaceId, projectId);
    }

    this.validateTransition(installation.pluginId, installation.state, 'INITIALIZING');

    // Register instance in execution manager
    this.executionManager.registerInstance(pluginId, instance);

    try {
      const config = (await this.store.getConfiguration(pluginId, workspaceId, projectId)) ?? {};
      await instance.initialize({
        pluginId,
        workspaceId,
        projectId,
        config,
        logger: {
          debug: (msg, meta) => console.debug(`[Plugin:${pluginId}] ${msg}`, meta ?? ''),
          info: (msg, meta) => console.info(`[Plugin:${pluginId}] ${msg}`, meta ?? ''),
          warn: (msg, meta) => console.warn(`[Plugin:${pluginId}] ${msg}`, meta ?? ''),
          error: (msg, meta) => console.error(`[Plugin:${pluginId}] ${msg}`, meta ?? ''),
        },
        events: {
          subscribe: () => () => {},
          publish: async () => {},
        },
      });

      const updated: PluginInstallation = {
        ...installation,
        state: 'INSTALLED',
        updatedAt: new Date().toISOString(),
      };
      await this.store.saveInstallation(updated);
    } catch (err: any) {
      const failed: PluginInstallation = {
        ...installation,
        state: 'FAILED',
        lastError: err.message,
        updatedAt: new Date().toISOString(),
      };
      await this.store.saveInstallation(failed);
      throw new PluginLifecycleError(pluginId, installation.state, 'INITIALIZING', err.message);
    }
  }

  public async enable(
    pluginId: string,
    workspaceId: string,
    projectId?: string,
    approvedBy: string = 'admin'
  ): Promise<PluginInstallation> {
    const installation = await this.store.getInstallation(pluginId, workspaceId, projectId);
    if (!installation) {
      throw new PluginNotFoundError(pluginId);
    }

    this.validateTransition(installation.pluginId, installation.state, 'ENABLED');

    // Verify permission grant exists
    const grant = await this.store.getGrant(pluginId, workspaceId, projectId);
    if (!grant || grant.status !== 'ACTIVE') {
      throw new PluginSecurityError(
        pluginId,
        `Cannot enable plugin '${pluginId}': no active permission grant found for workspace '${workspaceId}'.`
      );
    }

    // Verify dependencies
    const registration = await this.store.getRegistration(pluginId);
    if (registration && registration.descriptor.dependencies) {
      const missingDeps: string[] = [];
      for (const depId of Object.keys(registration.descriptor.dependencies)) {
        const depInst = await this.store.getInstallation(depId, workspaceId, projectId);
        if (!depInst || !depInst.enabled) {
          missingDeps.push(depId);
        }
      }
      if (missingDeps.length > 0) {
        throw new PluginDependencyError(
          pluginId,
          `Cannot enable plugin '${pluginId}': required dependencies are not installed/enabled: ${missingDeps.join(', ')}`,
          missingDeps
        );
      }
    }

    const enabledInstallation: PluginInstallation = {
      ...installation,
      state: 'ENABLED',
      enabled: true,
      updatedAt: new Date().toISOString(),
    };

    await this.store.saveInstallation(enabledInstallation);

    if (this.eventBus) {
      await this.eventBus.publish(PluginEventNames.PLUGIN_ENABLED, {
        id: `evt-${Date.now()}`,
        type: PluginEventNames.PLUGIN_ENABLED,
        timestamp: new Date(),
        senderId: 'PluginLifecycleManager',
        correlationId: enabledInstallation.installationId,
        metadata: { pluginId, workspaceId, projectId, approvedBy },
      });
    }

    return enabledInstallation;
  }

  public async disable(
    pluginId: string,
    workspaceId: string,
    projectId?: string,
    reason?: string
  ): Promise<PluginInstallation> {
    const installation = await this.store.getInstallation(pluginId, workspaceId, projectId);
    if (!installation) {
      throw new PluginNotFoundError(pluginId);
    }

    this.validateTransition(installation.pluginId, installation.state, 'DISABLED');

    // Check if other enabled plugins depend on this plugin
    const allInstalls = await this.store.listInstallations({ workspaceId, projectId, enabledOnly: true });
    for (const other of allInstalls) {
      if (other.pluginId === pluginId) continue;
      const otherReg = await this.store.getRegistration(other.pluginId);
      if (otherReg && otherReg.descriptor.dependencies && otherReg.descriptor.dependencies[pluginId]) {
        throw new PluginDependencyError(
          pluginId,
          `Cannot disable plugin '${pluginId}': enabled plugin '${other.pluginId}' depends on it.`
        );
      }
    }

    const disabledInstallation: PluginInstallation = {
      ...installation,
      state: 'DISABLED',
      enabled: false,
      updatedAt: new Date().toISOString(),
    };

    await this.store.saveInstallation(disabledInstallation);

    if (this.eventBus) {
      await this.eventBus.publish(PluginEventNames.PLUGIN_DISABLED, {
        id: `evt-${Date.now()}`,
        type: PluginEventNames.PLUGIN_DISABLED,
        timestamp: new Date(),
        senderId: 'PluginLifecycleManager',
        correlationId: disabledInstallation.installationId,
        metadata: { pluginId, workspaceId, projectId, reason },
      });
    }

    return disabledInstallation;
  }

  public async uninstall(
    pluginId: string,
    workspaceId: string,
    projectId?: string
  ): Promise<boolean> {
    const installation = await this.store.getInstallation(pluginId, workspaceId, projectId);
    if (!installation) {
      return false;
    }

    if (installation.enabled) {
      await this.disable(pluginId, workspaceId, projectId, 'Uninstalling');
    }

    this.executionManager.unregisterInstance(pluginId);
    await this.store.deleteInstallation(pluginId, workspaceId, projectId);
    await this.store.revokeGrant(pluginId, workspaceId, projectId);

    return true;
  }

  public async getPluginState(
    pluginId: string,
    workspaceId: string,
    projectId?: string
  ): Promise<PluginState> {
    const installation = await this.store.getInstallation(pluginId, workspaceId, projectId);
    return installation ? installation.state : 'UNINSTALLED';
  }

  private validateTransition(pluginId: string, from: PluginState, to: PluginState): void {
    if (!isValidPluginStateTransition(from, to)) {
      throw new PluginLifecycleError(pluginId, from, to);
    }
  }
}
