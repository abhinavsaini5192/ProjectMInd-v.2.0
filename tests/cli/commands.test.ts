import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CLIApplication } from '../../src/cli/core/CLIApplication.js';
import { CLIExitCode } from '../../src/cli/core/CLIExitCode.js';

describe('CLI Commands Suite', () => {
  let app: CLIApplication;
  let stdoutLogs: string[];
  let stderrLogs: string[];
  let tempDir: string;

  beforeEach(() => {
    stdoutLogs = [];
    stderrLogs = [];
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'projectmind-cli-test-'));

    app = CLIApplication.createDefault({
      stdout: (msg) => stdoutLogs.push(msg),
      stderr: (msg) => stderrLogs.push(msg),
    });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  describe('projectmind init', () => {
    it('initializes a new project workspace and writes .projectmind/config.json', async () => {
      const exitCode = await app.run(['init', '--workspace', tempDir, '--name', 'TestApp', '--json']);
      expect(exitCode).toBe(CLIExitCode.SUCCESS);

      const json = JSON.parse(stdoutLogs.join('\n'));
      expect(json.success).toBe(true);
      expect(json.data.repositoryName).toBe('TestApp');

      const configPath = path.join(tempDir, '.projectmind', 'config.json');
      expect(fs.existsSync(configPath)).toBe(true);
    });

    it('is safe for repeated execution without corrupting state', async () => {
      await app.run(['init', '--workspace', tempDir, '--name', 'RepeatApp']);
      stdoutLogs = [];

      const exitCode = await app.run(['init', '--workspace', tempDir, '--name', 'RepeatApp', '--json']);
      expect(exitCode).toBe(CLIExitCode.SUCCESS);

      const json = JSON.parse(stdoutLogs.join('\n'));
      expect(json.data.alreadyInitialized).toBe(true);
    });
  });

  describe('projectmind status', () => {
    it('displays status information in JSON format', async () => {
      const exitCode = await app.run(['status', '--workspace', tempDir, '--json']);
      expect(exitCode).toBe(CLIExitCode.SUCCESS);

      const json = JSON.parse(stdoutLogs.join('\n'));
      expect(json.success).toBe(true);
      expect(json.data.health).toBe('HEALTHY');
      expect(json.data.version).toBe('1.0.0');
      expect(json.data.project).toBeDefined();
    });

    it('displays status information in text format', async () => {
      const exitCode = await app.run(['status', '--workspace', tempDir]);
      expect(exitCode).toBe(CLIExitCode.SUCCESS);
      expect(stdoutLogs.some((l) => l.includes('HEALTHY'))).toBe(true);
    });
  });

  describe('projectmind analyze', () => {
    it('runs repository intelligence analysis', async () => {
      const exitCode = await app.run(['analyze', '--workspace', tempDir, '--json']);
      expect(exitCode).toBe(CLIExitCode.SUCCESS);

      const json = JSON.parse(stdoutLogs.join('\n'));
      expect(json.success).toBe(true);
      expect(json.data.summary.status).toBe('COMPLETE');
      expect(json.data.mode).toBe('FULL_REPOSITORY');
    });
  });

  describe('projectmind context', () => {
    it('retrieves compact explainable context for a task', async () => {
      const exitCode = await app.run(['context', 'fix authentication login bug', '--workspace', tempDir, '--json']);
      expect(exitCode).toBe(CLIExitCode.SUCCESS);

      const json = JSON.parse(stdoutLogs.join('\n'));
      expect(json.success).toBe(true);
      expect(json.data.task.text).toContain('fix authentication');
      expect(Array.isArray(json.data.relevantFeatures)).toBe(true);
    });

    it('handles context generation for a specific feature flag', async () => {
      const exitCode = await app.run(['context', '--feature', 'auth', '--workspace', tempDir, '--json']);
      expect(exitCode).toBe(CLIExitCode.SUCCESS);

      const json = JSON.parse(stdoutLogs.join('\n'));
      expect(json.success).toBe(true);
      expect(json.data.relevantFeatures).toContain('auth');
    });
  });

  describe('projectmind feature', () => {
    it('lists features', async () => {
      const exitCode = await app.run(['feature', 'list', '--workspace', tempDir, '--json']);
      expect(exitCode).toBe(CLIExitCode.SUCCESS);

      const json = JSON.parse(stdoutLogs.join('\n'));
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBeGreaterThan(0);
    });

    it('shows profile for a feature', async () => {
      const exitCode = await app.run(['feature', 'show', 'feat-auth', '--workspace', tempDir, '--json']);
      expect(exitCode).toBe(CLIExitCode.SUCCESS);

      const json = JSON.parse(stdoutLogs.join('\n'));
      expect(json.success).toBe(true);
      expect(json.data.featureId).toBe('feat-auth');
    });

    it('shows mappings, dependencies, behavior, health, and history for a feature', async () => {
      const subcommands = ['mappings', 'dependencies', 'behavior', 'health', 'history'];

      for (const sub of subcommands) {
        stdoutLogs = [];
        const exitCode = await app.run(['feature', sub, 'feat-auth', '--workspace', tempDir, '--json']);
        expect(exitCode).toBe(CLIExitCode.SUCCESS);

        const json = JSON.parse(stdoutLogs.join('\n'));
        expect(json.success).toBe(true);
        expect(json.data).toBeDefined();
      }
    });

    it('returns error when feature identifier is missing for show subcommand', async () => {
      const exitCode = await app.run(['feature', 'show', '--workspace', tempDir, '--json']);
      expect(exitCode).toBe(CLIExitCode.INVALID_USAGE);
    });
  });

  describe('projectmind impact', () => {
    it('analyzes change impact for a resource or feature', async () => {
      const exitCode = await app.run(['impact', 'src/auth/service.ts', '--workspace', tempDir, '--json']);
      expect(exitCode).toBe(CLIExitCode.SUCCESS);

      const json = JSON.parse(stdoutLogs.join('\n'));
      expect(json.success).toBe(true);
      expect(json.data.target).toBe('src/auth/service.ts');
      expect(Array.isArray(json.data.directlyAffectedFeatures)).toBe(true);
      expect(json.data.riskAssessment).toBeDefined();
    });
  });

  describe('projectmind history', () => {
    it('retrieves project and feature evolution history', async () => {
      const exitCode = await app.run(['history', '--workspace', tempDir, '--json']);
      expect(exitCode).toBe(CLIExitCode.SUCCESS);

      const json = JSON.parse(stdoutLogs.join('\n'));
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data.events)).toBe(true);
    });
  });

  describe('projectmind health', () => {
    it('returns platform subsystem health status', async () => {
      const exitCode = await app.run(['health', '--workspace', tempDir, '--json']);
      expect(exitCode).toBe(CLIExitCode.SUCCESS);

      const json = JSON.parse(stdoutLogs.join('\n'));
      expect(json.success).toBe(true);
      expect(json.data.status).toBe('HEALTHY');
      expect(json.data.components).toBeDefined();
    });
  });

  describe('projectmind update', () => {
    it('coordinates knowledge updates and refresh', async () => {
      const exitCode = await app.run(['update', '--workspace', tempDir, '--json']);
      expect(exitCode).toBe(CLIExitCode.SUCCESS);

      const json = JSON.parse(stdoutLogs.join('\n'));
      expect(json.success).toBe(true);
      expect(json.data.status).toBe('COMPLETED');
    });
  });

  describe('projectmind inspect', () => {
    it('inspects system state, repository, context, or features', async () => {
      const exitCode = await app.run(['inspect', 'context', '--workspace', tempDir, '--json']);
      expect(exitCode).toBe(CLIExitCode.SUCCESS);

      const json = JSON.parse(stdoutLogs.join('\n'));
      expect(json.success).toBe(true);
      expect(json.data.activePacker).toBe('ContextPackageBuilder');
    });
  });

  describe('projectmind doctor', () => {
    it('runs environment and installation diagnostics', async () => {
      const exitCode = await app.run(['doctor', '--workspace', tempDir, '--json']);
      expect(exitCode).toBe(CLIExitCode.SUCCESS);

      const json = JSON.parse(stdoutLogs.join('\n'));
      expect(json.success).toBe(true);
      expect(json.data.checks.length).toBeGreaterThan(0);
      expect(json.data.overall).toBeDefined();
    });
  });

  describe('projectmind completion', () => {
    it('generates bash completion script', async () => {
      const exitCode = await app.run(['completion', 'bash']);
      expect(exitCode).toBe(CLIExitCode.SUCCESS);
      expect(stdoutLogs.some((l) => l.includes('_projectmind_completions'))).toBe(true);
    });

    it('generates zsh completion script', async () => {
      const exitCode = await app.run(['completion', 'zsh']);
      expect(exitCode).toBe(CLIExitCode.SUCCESS);
      expect(stdoutLogs.some((l) => l.includes('#compdef projectmind'))).toBe(true);
    });

    it('generates fish completion script', async () => {
      const exitCode = await app.run(['completion', 'fish']);
      expect(exitCode).toBe(CLIExitCode.SUCCESS);
      expect(stdoutLogs.some((l) => l.includes('complete -c projectmind'))).toBe(true);
    });

    it('generates powershell completion script', async () => {
      const exitCode = await app.run(['completion', 'powershell']);
      expect(exitCode).toBe(CLIExitCode.SUCCESS);
      expect(stdoutLogs.some((l) => l.includes('Register-ArgumentCompleter'))).toBe(true);
    });

    it('errors on invalid shell specification', async () => {
      const exitCode = await app.run(['completion', 'unknownshell', '--json']);
      expect(exitCode).toBe(CLIExitCode.INVALID_USAGE);
    });
  });

  describe('Legacy & Utility Commands', () => {
    it('runs plugin command', async () => {
      const exitCode = await app.run(['plugin', 'list', '--workspace', tempDir, '--json']);
      expect(exitCode).toBe(CLIExitCode.SUCCESS);
      const json = JSON.parse(stdoutLogs.join('\n'));
      expect(json.data.plugins).toBeDefined();
    });

    it('runs compatibility command', async () => {
      const exitCode = await app.run(['compatibility', '--workspace', tempDir, '--json']);
      expect(exitCode).toBe(CLIExitCode.SUCCESS);
      const json = JSON.parse(stdoutLogs.join('\n'));
      expect(json.data.report.projectmindVersion).toBe('1.0.0');
    });
  });
});
