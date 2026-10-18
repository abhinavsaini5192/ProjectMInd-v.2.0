import type { IPluginService } from '../interfaces/IPluginService.js';
import type { IPluginStore, PluginRegistrationFilter, PluginInstallationFilter } from '../interfaces/IPluginStore.js';
import type { IPluginRegistry } from '../interfaces/IPluginRegistry.js';
import type { IPluginLifecycleManager } from '../interfaces/IPluginLifecycleManager.js';
import type { IPluginSecurityPolicy } from '../interfaces/IPluginSecurityPolicy.js';
import type { IPluginExecutionManager } from '../interfaces/IPluginExecutionManager.js';
import type { IPlugin, PluginHealthReport } from '../interfaces/IPlugin.js';
import type { PluginManifest } from '../models/PluginManifest.js';
import type { PluginRegistration } from '../models/PluginRegistration.js';
import type { PluginInstallation } from '../models/PluginInstallation.js';
import type { PluginPermissionGrant } from '../models/PluginPermissionGrant.js';
import type { PluginCompatibilityResult } from '../models/PluginCompatibilityResult.js';
import type { PluginInvocationRequest, PluginInvocationResult } from '../models/PluginInvocation.js';
import type { PluginType } from '../models/PluginType.js';
import { PluginManifestValidator } from './PluginManifestValidator.js';
import { PluginCompatibilityChecker } from './PluginCompatibilityChecker.js';
import { PluginNotFoundError, PluginError } from '../errors/PluginError.js';

export class PluginService implements IPluginService {
  private readonly validator = new PluginManifestValidator();
  private readonly compatibilityChecker = new PluginCompatibilityChecker();

  constructor(
    private readonly store: IPluginStore,
    private readonly registry: IPluginRegistry,
    private readonly lifecycle: IPluginLifecycleManager,
    private readonly securityPolicy: IPluginSecurityPolicy,
    private readonly executionManager: IPluginExecutionManager
  ) {}

  public validateManifest(rawManifest: unknown): PluginManifest {
    return this.validator.validate(rawManifest);
  }

  public async checkCompatibility(pluginId: string, targetVersion?: string): Promise<PluginCompatibilityResult> {
    const reg = await this.registry.getPlugin(pluginId);
    if (!reg) {
      throw new PluginNotFoundError(pluginId);
    }
    const manifest = this.validateManifest(reg.manifestRaw);
    return this.compatibilityChecker.checkCompatibility(manifest, targetVersion);
  }

  public async registerPlugin(
    manifestRaw: unknown,
    options?: { registeredBy?: string; source?: 'LOCAL' | 'REMOTE' | 'BUILTIN' | 'PACKAGE'; packageUri?: string; checksum?: string }
  ): Promise<PluginRegistration> {
    const manifest = this.validator.validate(manifestRaw);
    return this.registry.registerPlugin(manifest, options);
  }

  public async getPlugin(pluginId: string): Promise<PluginRegistration | undefined> {
    return this.registry.getPlugin(pluginId);
  }

  public async listPlugins(filter?: PluginRegistrationFilter): Promise<PluginRegistration[]> {
    return this.registry.listPlugins(filter);
  }

  public async unregisterPlugin(pluginId: string): Promise<boolean> {
    return this.registry.unregisterPlugin(pluginId);
  }

  public async getPluginsByType(type: PluginType): Promise<PluginRegistration[]> {
    return this.registry.resolveExtensionType(type);
  }

  public async installPlugin(
    pluginId: string,
    workspaceId: string,
    projectId?: string,
    installedBy?: string
  ): Promise<PluginInstallation> {
    return this.lifecycle.install(pluginId, workspaceId, projectId, installedBy);
  }

  public async initializePlugin(
    pluginId: string,
    instance: IPlugin,
    workspaceId: string,
    projectId?: string
  ): Promise<void> {
    return this.lifecycle.initialize(pluginId, instance, workspaceId, projectId);
  }

  public async enablePlugin(
    pluginId: string,
    workspaceId: string,
    projectId?: string,
    approvedBy?: string
  ): Promise<PluginInstallation> {
    return this.lifecycle.enable(pluginId, workspaceId, projectId, approvedBy);
  }

  public async disablePlugin(
    pluginId: string,
    workspaceId: string,
    projectId?: string,
    reason?: string
  ): Promise<PluginInstallation> {
    return this.lifecycle.disable(pluginId, workspaceId, projectId, reason);
  }

  public async uninstallPlugin(
    pluginId: string,
    workspaceId: string,
    projectId?: string
  ): Promise<boolean> {
    return this.lifecycle.uninstall(pluginId, workspaceId, projectId);
  }

  public async listInstallations(filter: PluginInstallationFilter): Promise<PluginInstallation[]> {
    return this.store.listInstallations(filter);
  }

  public async grantPermissions(grant: PluginPermissionGrant): Promise<void> {
    return this.securityPolicy.grantPermissions(grant);
  }

  public async revokePermissions(pluginId: string, workspaceId: string, projectId?: string): Promise<void> {
    return this.securityPolicy.revokePermissions(pluginId, workspaceId, projectId);
  }

  public async getGrants(workspaceId: string, projectId?: string): Promise<PluginPermissionGrant[]> {
    return this.store.listGrants(workspaceId, projectId);
  }

  public async invokePlugin(request: PluginInvocationRequest): Promise<PluginInvocationResult> {
    // 1. Check security policy
    await this.securityPolicy.evaluateInvocation(request);

    // 2. Check installation enabled status
    const installation = await this.store.getInstallation(request.pluginId, request.workspaceId, request.projectId);
    if (!installation || !installation.enabled) {
      throw new PluginError(
        `Plugin '${request.pluginId}' is not installed or enabled in workspace '${request.workspaceId}'.`,
        'PLUGIN_NOT_ENABLED'
      );
    }

    // 3. Delegate to execution manager
    return this.executionManager.invoke(request);
  }

  public async checkHealth(pluginId: string): Promise<PluginHealthReport> {
    return this.executionManager.checkHealth(pluginId);
  }

  public async configurePlugin(
    pluginId: string,
    workspaceId: string,
    config: Record<string, unknown>,
    projectId?: string
  ): Promise<void> {
    const reg = await this.registry.getPlugin(pluginId);
    if (!reg) {
      throw new PluginNotFoundError(pluginId);
    }

    await this.store.saveConfiguration(pluginId, workspaceId, config, projectId);
  }

  public async getConfiguration(
    pluginId: string,
    workspaceId: string,
    projectId?: string
  ): Promise<Record<string, unknown> | undefined> {
    return this.store.getConfiguration(pluginId, workspaceId, projectId);
  }

  public async getExecutionHistory(pluginId: string, limit?: number): Promise<unknown[]> {
    return this.store.listExecutionRecords(pluginId, limit);
  }
}
