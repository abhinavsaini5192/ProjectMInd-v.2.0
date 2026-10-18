import { describe, it, expect, beforeEach } from 'vitest';
import { CLIApplication } from '../../src/cli/core/CLIApplication.js';
import { CLIExitCode } from '../../src/cli/core/CLIExitCode.js';
import { CommandRegistry } from '../../src/cli/core/CommandRegistry.js';
import type { CLICommand } from '../../src/cli/core/CLICommand.js';
import type { CLIContext } from '../../src/cli/core/CLIContext.js';
import { createSuccessResult, createErrorResult } from '../../src/cli/core/CLIResult.js';

describe('CLIApplication', () => {
  let app: CLIApplication;
  let stdoutLogs: string[];
  let stderrLogs: string[];

  beforeEach(() => {
    stdoutLogs = [];
    stderrLogs = [];
    app = CLIApplication.createDefault({
      stdout: (msg) => stdoutLogs.push(msg),
      stderr: (msg) => stderrLogs.push(msg),
    });
  });

  describe('Argument Parsing', () => {
    it('correctly parses command name and positional arguments', () => {
      const parsed = app.parseArgs(['context', 'fix', 'bug', 'in', 'auth']);
      expect(parsed.commandName).toBe('context');
      expect(parsed.args).toEqual(['fix', 'bug', 'in', 'auth']);
    });

    it('correctly parses boolean and value options', () => {
      const parsed = app.parseArgs(['feature', 'show', 'auth', '--json', '--workspace=/tmp/test', '--verbose']);
      expect(parsed.commandName).toBe('feature');
      expect(parsed.args).toEqual(['show', 'auth']);
      expect(parsed.format).toBe('json');
      expect(parsed.isVerbose).toBe(true);
      expect(parsed.workspacePath).toBe('/tmp/test');
    });

    it('correctly parses short flags and options with spaces', () => {
      const parsed = app.parseArgs(['init', '--name', 'MyRepo', '-h']);
      expect(parsed.commandName).toBe('init');
      expect(parsed.options['name']).toBe('MyRepo');
      expect(parsed.isHelp).toBe(true);
    });
  });

  describe('Global Options and Fast Paths', () => {
    it('executes version command on --version flag', async () => {
      const exitCode = await app.run(['--version']);
      expect(exitCode).toBe(CLIExitCode.SUCCESS);
      expect(stdoutLogs.some((l) => l.includes('1.0.0'))).toBe(true);
    });

    it('executes version command with --json output', async () => {
      const exitCode = await app.run(['version', '--json']);
      expect(exitCode).toBe(CLIExitCode.SUCCESS);
      const jsonOutput = JSON.parse(stdoutLogs.join('\n'));
      expect(jsonOutput.success).toBe(true);
      expect(jsonOutput.command).toBe('version');
      expect(jsonOutput.data.version).toBe('1.0.0');
    });

    it('executes global help on empty args or --help', async () => {
      const exitCode = await app.run(['--help']);
      expect(exitCode).toBe(CLIExitCode.SUCCESS);
      expect(stdoutLogs.some((l) => l.includes('ProjectMind CLI'))).toBe(true);
    });

    it('displays command-specific help when --help is passed with a command', async () => {
      const exitCode = await app.run(['status', '--help']);
      expect(exitCode).toBe(CLIExitCode.SUCCESS);
      expect(stdoutLogs.some((l) => l.includes('Command') && l.includes('status'))).toBe(true);
    });
  });

  describe('Command Dispatch and Exit Codes', () => {
    it('returns INVALID_USAGE for unknown command', async () => {
      const exitCode = await app.run(['nonexistent-command-xyz']);
      expect(exitCode).toBe(CLIExitCode.INVALID_USAGE);
      expect(stderrLogs.some((l) => l.includes('Unknown command'))).toBe(true);
    });

    it('emits machine-readable JSON on error when --json is passed', async () => {
      const exitCode = await app.run(['unknown-cmd', '--json']);
      expect(exitCode).toBe(CLIExitCode.INVALID_USAGE);
      const json = JSON.parse(stderrLogs.join('\n'));
      expect(json.success).toBe(false);
      expect(json.exitCode).toBe(CLIExitCode.INVALID_USAGE);
      expect(json.errors.length).toBeGreaterThan(0);
    });

    it('allows registering and executing custom commands', async () => {
      const customApp = new CLIApplication({
        stdout: (msg) => stdoutLogs.push(msg),
        stderr: (msg) => stderrLogs.push(msg),
      });

      const customCmd: CLICommand = {
        name: 'custom',
        description: 'Test custom command',
        execute: async (ctx: CLIContext) => {
          return createSuccessResult('custom', { customKey: 'customVal' }, 'Custom executed');
        },
      };

      customApp.register(customCmd);
      const exitCode = await customApp.run(['custom', '--json']);
      expect(exitCode).toBe(CLIExitCode.SUCCESS);
      const json = JSON.parse(stdoutLogs.join('\n'));
      expect(json.data.customKey).toBe('customVal');
    });
  });
});
