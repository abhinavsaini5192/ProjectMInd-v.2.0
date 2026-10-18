import fs from 'fs';
import type { CLICommand, CLICommandOption, CLICommandHelp } from '../core/CLICommand.js';
import type { CLIContext } from '../core/CLIContext.js';
import { type CLIResult, createSuccessResult, createErrorResult } from '../core/CLIResult.js';
import { CLIExitCode } from '../core/CLIExitCode.js';
import type { ProjectMindKernel } from '../../kernel/ProjectMindKernel.js';
import type { IPluginService } from '../../plugins/interfaces/IPluginService.js';
import { InMemoryPluginStore } from '../../plugins/services/InMemoryPluginStore.js';
import { PluginSecurityPolicyEngine } from '../../plugins/services/PluginSecurityPolicyEngine.js';
import { PluginExecutionManager } from '../../plugins/services/PluginExecutionManager.js';
import { PluginRegistry } from '../../plugins/services/PluginRegistry.js';
import { PluginLifecycleManager } from '../../plugins/services/PluginLifecycleManager.js';
import { PluginService } from '../../plugins/services/PluginService.js';

export class PluginCommand implements CLICommand {
  public readonly name = 'plugin';
  public readonly description = 'Manage ProjectMind plugins, lifecycles, and integrations (Phase 9.8)';
  public readonly usage = 'projectmind plugin <list|inspect|info|validate|register|enable|disable|health|configure|uninstall|remove|doctor> [plugin_id] [--json]';

  public readonly help: CLICommandHelp = {
    summary: 'Manage ProjectMind plugins, lifecycles, and integrations.',
    usage: 'projectmind plugin <subcommand> [args] [options]',
    examples: [
      'projectmind plugin list',
      'projectmind plugin inspect git-analyzer',
      'projectmind plugin validate ./plugin-manifest.json',
      'projectmind plugin register ./plugin-manifest.json',
      'projectmind plugin enable git-analyzer',
      'projectmind plugin disable git-analyzer',
      'projectmind plugin health git-analyzer',
      'projectmind plugin doctor',
    ],
    subcommands: [
      { name: 'list', description: 'List registered/installed plugins' },
      { name: 'inspect', description: 'Inspect plugin details and registration metadata' },
      { name: 'info', description: 'Alias for inspect' },
      { name: 'validate', description: 'Validate a plugin manifest file' },
      { name: 'register', description: 'Register a plugin from a manifest file' },
      { name: 'enable', description: 'Enable a registered plugin' },
      { name: 'disable', description: 'Disable an enabled plugin' },
      { name: 'health', description: 'Check health status of a plugin' },
      { name: 'configure', description: 'Configure settings for an installed plugin' },
      { name: 'uninstall', description: 'Uninstall and clean up a plugin' },
      { name: 'remove', description: 'Alias for uninstall' },
      { name: 'doctor', description: 'Run diagnostics on plugins and environment' },
    ],
    options: [
      { name: 'json', description: 'Output plugin details in JSON format', type: 'boolean' },
      { name: 'config', description: 'Configuration JSON string or path', type: 'string' },
    ],
  };

  public readonly options: readonly CLICommandOption[] = [
    {
      name: 'json',
      description: 'Output plugin details in JSON format',
      hasValue: false,
    },
    {
      name: 'config',
      description: 'Configuration JSON string or path',
      hasValue: true,
    },
  ];

  public readonly examples = [
    'projectmind plugin list',
    'projectmind plugin inspect git-analyzer',
    'projectmind plugin enable git-analyzer',
    'projectmind plugin disable git-analyzer',
    'projectmind plugin doctor',
  ];

  private readonly service: IPluginService;

  constructor(private kernel?: ProjectMindKernel, service?: IPluginService) {
    if (service) {
      this.service = service;
    } else if (kernel?.pluginRuntime?.service) {
      this.service = kernel.pluginRuntime.service;
    } else {
      const store = new InMemoryPluginStore();
      const sec = new PluginSecurityPolicyEngine(store);
      const exec = new PluginExecutionManager(store);
      const reg = new PluginRegistry(store);
      const life = new PluginLifecycleManager(store, exec, sec);
      this.service = new PluginService(store, reg, life, sec, exec);
    }
  }

  public async execute(ctxOrArgs: CLIContext | string[], maybeKernel?: ProjectMindKernel): Promise<any> {
    if (Array.isArray(ctxOrArgs)) {
      const args = ctxOrArgs;
      const kernel = maybeKernel ?? this.kernel;
      if (!kernel) {
        throw new Error('Kernel required for legacy PluginCommand execution');
      }
      const action = args[0] ?? 'list';
      switch (action) {
        case 'install':
          console.log(`Installing plugin: ${args.slice(1).join(' ')}`);
          break;
        case 'remove':
          console.log(`Removing plugin: ${args.slice(1).join(' ')}`);
          break;
        case 'enable':
          console.log(`Enabling plugin: ${args[1]}`);
          break;
        case 'disable':
          console.log(`Disabling plugin: ${args[1]}`);
          break;
        case 'list': {
          const plugins = kernel.pluginRuntime.getPlugins();
          console.log(`\nInstalled Plugins (${plugins.length}):`);
          plugins.forEach((p) => {
            console.log(`- ${p.name} [${p.id}] v${p.version} - State: ${p.state}`);
          });
          console.log('');
          break;
        }
        case 'info':
        case 'inspect': {
          const pluginId = args[1];
          if (!pluginId) {
            console.error('Error: Please provide a plugin ID.');
            return;
          }
          const plugin = kernel.pluginRuntime.getPlugins().find((p) => p.id === pluginId);
          if (!plugin) {
            console.error(`Error: Plugin '${pluginId}' not found.`);
            return;
          }
          console.log(`\nPlugin Info: ${plugin.name}\nID: ${plugin.id}\nVersion: ${plugin.version}\nState: ${plugin.state}\n`);
          break;
        }
        default:
          console.log(`Usage: projectmind plugin <list|inspect|info|enable|disable|install|remove> [args]`);
      }
      return;
    }

    const ctx = ctxOrArgs;
    const action = ctx.args[0] ?? 'list';
    const targetId = ctx.args[1];
    const workspaceId = ctx.workspaceId ?? 'default-workspace';

    switch (action) {
      case 'list': {
        const plugins = await this.service.listPlugins();
        return createSuccessResult(
          this.name,
          {
            count: plugins.length,
            plugins: plugins.map((p) => ({
              id: p.pluginId,
              name: p.descriptor.name,
              version: p.version,
              state: p.state,
              type: p.descriptor.pluginType,
              publisher: p.descriptor.publisher,
            })),
          },
          `Found ${plugins.length} registered plugin(s)`
        );
      }

      case 'inspect':
      case 'info': {
        if (!targetId) {
          return createErrorResult(
            this.name,
            CLIExitCode.INVALID_USAGE,
            'Missing plugin ID for inspect command.',
            ['Usage: projectmind plugin inspect <plugin_id>']
          );
        }
        const plugin = await this.service.getPlugin(targetId);
        if (!plugin) {
          return createErrorResult(
            this.name,
            CLIExitCode.RESOURCE_NOT_FOUND,
            `Plugin '${targetId}' was not found.`,
            [`Run 'projectmind plugin list' to see all available plugins.`]
          );
        }
        return createSuccessResult(
          this.name,
          plugin,
          `Plugin details for '${plugin.descriptor.name}' (v${plugin.version})`
        );
      }

      case 'validate': {
        if (!targetId) {
          return createErrorResult(
            this.name,
            CLIExitCode.INVALID_USAGE,
            'Missing manifest path for validate command.',
            ['Usage: projectmind plugin validate <manifest_path>']
          );
        }
        try {
          let manifestContent: unknown;
          if (fs.existsSync(targetId)) {
            manifestContent = JSON.parse(fs.readFileSync(targetId, 'utf-8'));
          } else {
            manifestContent = JSON.parse(targetId);
          }
          const validated = this.service.validateManifest(manifestContent);
          return createSuccessResult(
            this.name,
            validated,
            `Plugin manifest for '${validated.name}' is valid.`
          );
        } catch (err: any) {
          return createErrorResult(
            this.name,
            CLIExitCode.EXECUTION_ERROR,
            `Manifest validation failed: ${err.message}`
          );
        }
      }

      case 'register': {
        if (!targetId) {
          return createErrorResult(
            this.name,
            CLIExitCode.INVALID_USAGE,
            'Missing manifest path for register command.',
            ['Usage: projectmind plugin register <manifest_path>']
          );
        }
        try {
          let manifestContent: unknown;
          if (fs.existsSync(targetId)) {
            manifestContent = JSON.parse(fs.readFileSync(targetId, 'utf-8'));
          } else {
            manifestContent = JSON.parse(targetId);
          }
          const reg = await this.service.registerPlugin(manifestContent, { registeredBy: 'cli' });
          return createSuccessResult(
            this.name,
            reg,
            `Plugin '${reg.pluginId}' registered successfully.`
          );
        } catch (err: any) {
          return createErrorResult(
            this.name,
            CLIExitCode.EXECUTION_ERROR,
            `Plugin registration failed: ${err.message}`
          );
        }
      }

      case 'enable': {
        if (!targetId) {
          return createErrorResult(
            this.name,
            CLIExitCode.INVALID_USAGE,
            'Missing plugin ID for plugin enable command.'
          );
        }
        try {
          const workspaceId = (ctx as any).getOption?.('workspace') ?? ctx.workspacePath ?? 'default-workspace';
          await this.service.installPlugin(targetId, workspaceId);
          // Auto-grant for CLI admin user if not present
          await this.service.grantPermissions({
            grantId: `grant-${Date.now()}`,
            pluginId: targetId,
            workspaceId,
            grantedCapabilities: ['PROVIDE_CONTEXT', 'PROVIDE_TOOL', 'PROVIDE_RETRIEVAL'],
            grantedPermissions: ['*'],
            approvedBy: 'cli-admin',
            approvedAt: new Date().toISOString(),
            status: 'ACTIVE',
          });

          const inst = await this.service.enablePlugin(targetId, workspaceId);
          return createSuccessResult(
            this.name,
            inst,
            `Plugin '${targetId}' enabled successfully.`
          );
        } catch (err: any) {
          return createErrorResult(
            this.name,
            CLIExitCode.EXECUTION_ERROR,
            `Failed to enable plugin '${targetId}': ${err.message}`
          );
        }
      }

      case 'disable': {
        if (!targetId) {
          return createErrorResult(
            this.name,
            CLIExitCode.INVALID_USAGE,
            'Missing plugin ID for plugin disable command.'
          );
        }
        try {
          const workspaceId = (ctx as any).getOption?.('workspace') ?? ctx.workspacePath ?? 'default-workspace';
          const inst = await this.service.disablePlugin(targetId, workspaceId);
          return createSuccessResult(
            this.name,
            inst,
            `Plugin '${targetId}' disabled successfully.`
          );
        } catch (err: any) {
          return createErrorResult(
            this.name,
            CLIExitCode.EXECUTION_ERROR,
            `Failed to disable plugin '${targetId}': ${err.message}`
          );
        }
      }

      case 'health': {
        if (!targetId) {
          return createErrorResult(
            this.name,
            CLIExitCode.INVALID_USAGE,
            'Missing plugin ID for plugin health command.'
          );
        }
        const report = await this.service.checkHealth(targetId);
        return createSuccessResult(
          this.name,
          report,
          `Plugin '${targetId}' health: ${report.status}`
        );
      }

      case 'configure': {
        if (!targetId) {
          return createErrorResult(
            this.name,
            CLIExitCode.INVALID_USAGE,
            'Missing plugin ID for plugin configure command.'
          );
        }
        const configStr = (ctx as any).getOption?.('config') ?? ctx.args[2];
        let cfg = {};
        if (configStr) {
          try {
            cfg = JSON.parse(configStr);
          } catch {
            cfg = { value: configStr };
          }
        }
        await this.service.configurePlugin(targetId, workspaceId, cfg);
        return createSuccessResult(
          this.name,
          { pluginId: targetId, config: cfg },
          `Plugin '${targetId}' configured successfully.`
        );
      }

      case 'uninstall':
      case 'remove': {
        if (!targetId) {
          return createErrorResult(
            this.name,
            CLIExitCode.INVALID_USAGE,
            'Missing plugin ID for plugin uninstall command.'
          );
        }
        const removed = await this.service.unregisterPlugin(targetId);
        if (!removed) {
          return createErrorResult(
            this.name,
            CLIExitCode.RESOURCE_NOT_FOUND,
            `Plugin '${targetId}' was not found.`
          );
        }
        return createSuccessResult(
          this.name,
          { pluginId: targetId, uninstalled: true },
          `Plugin '${targetId}' uninstalled successfully.`
        );
      }

      case 'doctor': {
        const plugins = await this.service.listPlugins();
        const results: Record<string, unknown>[] = [];
        for (const p of plugins) {
          const compat = await this.service.checkCompatibility(p.pluginId);
          const health = await this.service.checkHealth(p.pluginId);
          results.push({
            pluginId: p.pluginId,
            version: p.version,
            compatible: compat.compatible,
            issues: compat.issues,
            health: health.status,
          });
        }
        return createSuccessResult(
          this.name,
          {
            checkedPlugins: plugins.length,
            diagnostics: results,
          },
          `Plugin doctor diagnostic check completed for ${plugins.length} plugin(s).`
        );
      }

      default:
        return createErrorResult(
          this.name,
          CLIExitCode.INVALID_USAGE,
          `Unknown plugin action '${action}'. Valid actions: list, inspect, info, validate, register, enable, disable, health, configure, uninstall, remove, doctor.`
        );
    }
  }
}
