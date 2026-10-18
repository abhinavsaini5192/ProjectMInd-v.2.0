import { describe, it, expect, beforeEach } from 'vitest';
import { CLIApplication } from '../../src/cli/core/CLIApplication.js';
import { CLIExitCode } from '../../src/cli/core/CLIExitCode.js';
import { CommandRegistry } from '../../src/cli/core/CommandRegistry.js';
import { PluginCommand } from '../../src/cli/commands/PluginCommand.js';
import { InMemoryPluginStore } from '../../src/plugins/services/InMemoryPluginStore.js';
import { PluginRegistry } from '../../src/plugins/services/PluginRegistry.js';
import { PluginLifecycleManager } from '../../src/plugins/services/PluginLifecycleManager.js';
import { PluginSecurityPolicyEngine } from '../../src/plugins/services/PluginSecurityPolicyEngine.js';
import { PluginExecutionManager } from '../../src/plugins/services/PluginExecutionManager.js';
import { PluginService } from '../../src/plugins/services/PluginService.js';

describe('Phase 9.8 — Plugin CLI Commands', () => {
  let app: CLIApplication;
  let service: PluginService;
  let stdoutLogs: string[];
  let stderrLogs: string[];
  const testWorkspace = 'test-ws-cli-plugins';

  beforeEach(() => {
    stdoutLogs = [];
    stderrLogs = [];

    const store = new InMemoryPluginStore();
    const sec = new PluginSecurityPolicyEngine(store);
    const exec = new PluginExecutionManager(store);
    const reg = new PluginRegistry(store);
    const life = new PluginLifecycleManager(store, exec, sec);

    service = new PluginService(store, reg, life, sec, exec);

    const registry = new CommandRegistry();
    registry.register(new PluginCommand(undefined, service));

    app = new CLIApplication({
      registry,
      stdout: (msg) => stdoutLogs.push(msg),
      stderr: (msg) => stderrLogs.push(msg),
    });
  });

  it('35. projectmind plugin list should return registered plugins with --json', async () => {
    await service.registerPlugin({
      pluginId: 'cli-plugin-1',
      name: 'CLI Plugin One',
      version: '1.0.0',
    });

    const exitCode = await app.run(['plugin', 'list', '--json']);
    expect(exitCode).toBe(CLIExitCode.SUCCESS);
    const json = JSON.parse(stdoutLogs.join('\n'));
    expect(json.data.count).toBe(1);
    expect(json.data.plugins[0].id).toBe('cli-plugin-1');
  });

  it('projectmind plugin inspect should show detailed plugin info', async () => {
    await service.registerPlugin({
      pluginId: 'cli-plugin-inspect',
      name: 'Inspect Me',
      version: '2.0.0',
      description: 'Test inspection',
    });

    stdoutLogs = [];
    const exitCode = await app.run(['plugin', 'inspect', 'cli-plugin-inspect', '--json']);
    expect(exitCode).toBe(CLIExitCode.SUCCESS);
    const json = JSON.parse(stdoutLogs.join('\n'));
    expect(json.data.pluginId).toBe('cli-plugin-inspect');
    expect(json.data.version).toBe('2.0.0');
  });

  it('projectmind plugin validate should validate raw manifest string or file', async () => {
    const validManifestJson = JSON.stringify({
      pluginId: 'cli-validated',
      name: 'Validated CLI Plugin',
      version: '1.0.0',
    });

    stdoutLogs = [];
    const exitCode = await app.run(['plugin', 'validate', validManifestJson, '--json']);
    expect(exitCode).toBe(CLIExitCode.SUCCESS);
    const json = JSON.parse(stdoutLogs.join('\n'));
    expect(json.data.pluginId).toBe('cli-validated');
  });

  it('projectmind plugin enable and disable should toggle plugin state', async () => {
    await service.registerPlugin({
      pluginId: 'toggle-plugin',
      name: 'Toggle Plugin',
      version: '1.0.0',
    });

    // Enable
    stdoutLogs = [];
    const enableExit = await app.run(['plugin', 'enable', 'toggle-plugin', '--workspace', testWorkspace, '--json']);
    expect(enableExit).toBe(CLIExitCode.SUCCESS);
    const enableJson = JSON.parse(stdoutLogs.join('\n'));
    expect(enableJson.data.state).toBe('ENABLED');

    // Disable
    stdoutLogs = [];
    const disableExit = await app.run(['plugin', 'disable', 'toggle-plugin', '--workspace', testWorkspace, '--json']);
    expect(disableExit).toBe(CLIExitCode.SUCCESS);
    const disableJson = JSON.parse(stdoutLogs.join('\n'));
    expect(disableJson.data.state).toBe('DISABLED');
  });

  it('projectmind plugin doctor should diagnose registered plugins', async () => {
    await service.registerPlugin({
      pluginId: 'doc-plugin',
      name: 'Doctor Test Plugin',
      version: '1.0.0',
    });

    stdoutLogs = [];
    const exitCode = await app.run(['plugin', 'doctor', '--json']);
    expect(exitCode).toBe(CLIExitCode.SUCCESS);
    const json = JSON.parse(stdoutLogs.join('\n'));
    expect(json.data.checkedPlugins).toBe(1);
    expect(json.data.diagnostics[0].compatible).toBe(true);
  });
});
