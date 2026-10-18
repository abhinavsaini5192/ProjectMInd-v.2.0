import { Plugin, PluginState } from '../interfaces/Plugin.js';
import { PluginManifest, validateManifest } from './PluginManifest.js';
import { DependencyResolver } from './DependencyResolver.js';
import { PermissionManager } from './PermissionManager.js';
import { CapabilityRegistry } from './CapabilityRegistry.js';
import { ProjectMindSDK } from '../sdk/ProjectMindSDK.js';
import type { ProjectMindKernel } from '../kernel/ProjectMindKernel.js';
import { InMemoryPluginStore } from './services/InMemoryPluginStore.js';
import { PluginSecurityPolicyEngine } from './services/PluginSecurityPolicyEngine.js';
import { PluginExecutionManager } from './services/PluginExecutionManager.js';
import { PluginRegistry } from './services/PluginRegistry.js';
import { PluginLifecycleManager } from './services/PluginLifecycleManager.js';
import { PluginService } from './services/PluginService.js';
import type { IPluginService } from './interfaces/IPluginService.js';

/**
 * The PluginRuntime is responsible for the complete lifecycle of all plugins.
 * In Phase 9.8, it wraps and exposes the canonical PluginService facade while
 * preserving 100% backward compatibility for existing kernel callers.
 */
export class PluginRuntime {
  private plugins: Map<string, Plugin> = new Map();
  private manifests: Map<string, PluginManifest> = new Map();

  public readonly permissionManager = new PermissionManager();
  public readonly capabilityRegistry = new CapabilityRegistry();
  public readonly service: IPluginService;

  constructor(private readonly kernel: ProjectMindKernel) {
    const store = new InMemoryPluginStore();
    const securityPolicy = new PluginSecurityPolicyEngine(store);
    const executionManager = new PluginExecutionManager(store);
    const registry = new PluginRegistry(store, kernel.eventDispatcher as any);
    const lifecycle = new PluginLifecycleManager(store, executionManager, securityPolicy, kernel.eventDispatcher as any);
    this.service = new PluginService(store, registry, lifecycle, securityPolicy, executionManager);
  }

  /**
   * Registers a plugin manually.
   * @param manifestRaw The raw JSON manifest.
   * @param plugin The instantiated Plugin object.
   */
  public registerPlugin(manifestRaw: unknown, plugin: Plugin): void {
    const manifest = validateManifest(manifestRaw);
    
    if (plugin.id !== manifest.id) {
      throw new Error(`Plugin ID mismatch: Instance ID '${plugin.id}' does not match manifest ID '${manifest.id}'`);
    }

    this.manifests.set(plugin.id, manifest);
    this.plugins.set(plugin.id, plugin);
    plugin.state = PluginState.INSTALLED;
    
    // Register permissions requested by the plugin
    this.permissionManager.registerPluginPermissions(plugin.id, manifest.permissions);

    // Also register asynchronously in canonical Phase 9.8 registry
    this.service.registerPlugin({
      pluginId: manifest.id,
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      publisher: manifest.author || 'community',
      entrypoint: manifest.entryPoint,
      declaredCapabilities: manifest.capabilities ?? [],
      requestedPermissions: manifest.permissions ?? [],
    }).catch(() => {});
  }

  /**
   * Initializes all installed plugins in dependency-resolved order.
   */
  public async initializeAll(): Promise<void> {
    const sortedManifests = DependencyResolver.sort(Array.from(this.manifests.values()));

    for (const manifest of sortedManifests) {
      const plugin = this.plugins.get(manifest.id)!;
      try {
        const sdk = new ProjectMindSDK(
          plugin.id,
          this.kernel,
          this.permissionManager,
          this.capabilityRegistry
        );

        plugin.state = PluginState.INITIALIZED;
        await plugin.initialize(sdk);
        this.kernel.eventDispatcher.dispatch('PluginInitialized.v1', { pluginId: plugin.id });
      } catch (err: any) {
        plugin.state = PluginState.FAILED;
        console.error(`Failed to initialize plugin ${plugin.id}:`, err);
        this.kernel.eventDispatcher.dispatch('PluginFailed.v1', { pluginId: plugin.id, error: err.message });
      }
    }
  }

  /**
   * Starts all initialized plugins.
   */
  public async startAll(): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.state === PluginState.INITIALIZED) {
        try {
          plugin.state = PluginState.RUNNING;
          await plugin.start();
          this.kernel.eventDispatcher.dispatch('PluginStarted.v1', { pluginId: plugin.id });
        } catch (err: any) {
          plugin.state = PluginState.FAILED;
          console.error(`Failed to start plugin ${plugin.id}:`, err);
          this.kernel.eventDispatcher.dispatch('PluginFailed.v1', { pluginId: plugin.id, error: err.message });
        }
      }
    }
  }

  /**
   * Stops all running plugins.
   */
  public async stopAll(): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.state === PluginState.RUNNING || plugin.state === PluginState.FAILED) {
        try {
          await plugin.stop();
          plugin.state = PluginState.DISABLED;
        } catch (err) {
          console.error(`Failed to stop plugin ${plugin.id}:`, err);
        }
      }
    }
  }

  /**
   * Get a list of all loaded plugins.
   */
  public getPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }
}
