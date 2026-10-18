import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PlatformConfigLoader } from '../../src/platform/config/PlatformConfigLoader.js';
import {
  PlatformConfigValidator,
  PlatformConfigurationError,
  KNOWN_INSECURE_KEYS,
} from '../../src/platform/config/PlatformConfigValidator.js';
import { CLIApplication } from '../../src/cli/core/CLIApplication.js';
import { DeploymentRunner } from '../../src/platform/runner/DeploymentRunner.js';
import { CLIExitCode } from '../../src/cli/core/CLIExitCode.js';
import { ProductionBootstrap } from '../../src/platform/bootstrap/ProductionBootstrap.js';

describe('Production Secret Enforcement & Redis Validation (Remediation 1)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('1. PlatformConfigValidator — Fail-Closed Production Policy', () => {
    it('rejects missing PROJECTMIND_MASTER_KEY when environment is production', () => {
      delete process.env['PROJECTMIND_MASTER_KEY'];
      delete process.env['PROJECTMIND_SECRET_KEY'];
      process.env['PROJECTMIND_ENV'] = 'production';

      expect(() => {
        PlatformConfigLoader.load();
      }).toThrowError(PlatformConfigurationError);

      try {
        PlatformConfigLoader.load();
      } catch (err: any) {
        expect(err.message).toContain('PROJECTMIND_MASTER_KEY is required in production environments');
      }
    });

    it('rejects empty or whitespace-only master key in production', () => {
      process.env['PROJECTMIND_ENV'] = 'production';
      process.env['PROJECTMIND_MASTER_KEY'] = '   ';

      expect(() => {
        PlatformConfigLoader.load();
      }).toThrowError(/PROJECTMIND_MASTER_KEY is required in production/);
    });

    it('rejects keys matching known insecure development defaults in production', () => {
      process.env['PROJECTMIND_ENV'] = 'production';

      for (const insecureKey of KNOWN_INSECURE_KEYS) {
        process.env['PROJECTMIND_MASTER_KEY'] = insecureKey;
        expect(
          () => PlatformConfigLoader.load(),
          `Should reject known insecure key: "${insecureKey}"`
        ).toThrowError(/matches a known insecure development default/);
      }
    });

    it('rejects master keys shorter than 32 characters (256 bits) in production', () => {
      process.env['PROJECTMIND_ENV'] = 'production';
      process.env['PROJECTMIND_MASTER_KEY'] = 'short-key-16-ch!'; // 16 characters

      expect(() => {
        PlatformConfigLoader.load();
      }).toThrowError(/must be at least 32 characters \(256 bits\)/);
    });

    it('accepts valid cryptographic master key (>= 32 chars) in production', () => {
      process.env['PROJECTMIND_ENV'] = 'production';
      process.env['PROJECTMIND_MASTER_KEY'] = 'a-secure-production-key-with-sufficient-length-32+chars';

      const config = PlatformConfigLoader.load();
      expect(config.app.env).toBe('production');
      expect(config.security.masterKey).toBe('a-secure-production-key-with-sufficient-length-32+chars');
    });

    it('does not leak secret values in error messages or validation reports', () => {
      const sensitiveCandidate = 'dev_secret_key';
      process.env['PROJECTMIND_ENV'] = 'production';
      process.env['PROJECTMIND_MASTER_KEY'] = sensitiveCandidate;

      try {
        PlatformConfigLoader.load();
        expect.unreachable('Should have thrown error');
      } catch (err: any) {
        expect(err.message).not.toContain(sensitiveCandidate);
      }
    });

    it('permits default development fallback when environment is development', () => {
      delete process.env['PROJECTMIND_ENV'];
      delete process.env['NODE_ENV'];
      delete process.env['PROJECTMIND_MASTER_KEY'];
      delete process.env['PROJECTMIND_SECRET_KEY'];

      const config = PlatformConfigLoader.load();
      expect(config.app.env).toBe('development');
      expect(config.security.masterKey).toBeUndefined();
    });
  });

  describe('2. Startup Entry Points & DeploymentRunner Fail-Closed Behavior', () => {
    it('prevents DeploymentRunner startup for API role in production without master key', async () => {
      delete process.env['PROJECTMIND_MASTER_KEY'];
      process.env['PROJECTMIND_ENV'] = 'production';

      await expect(
        DeploymentRunner.run({ role: 'api' })
      ).rejects.toThrowError(PlatformConfigurationError);
    });

    it('prevents DeploymentRunner startup for Worker role in production without master key', async () => {
      delete process.env['PROJECTMIND_MASTER_KEY'];
      process.env['PROJECTMIND_ENV'] = 'production';

      await expect(
        DeploymentRunner.run({ role: 'worker' })
      ).rejects.toThrowError(PlatformConfigurationError);
    });

    it('prevents DeploymentRunner startup for Migration role in production without master key', async () => {
      delete process.env['PROJECTMIND_MASTER_KEY'];
      process.env['PROJECTMIND_ENV'] = 'production';

      await expect(
        DeploymentRunner.run({ role: 'migration' })
      ).rejects.toThrowError(PlatformConfigurationError);
    });

    it('prevents DeploymentRunner startup for All role in production without master key', async () => {
      delete process.env['PROJECTMIND_MASTER_KEY'];
      process.env['PROJECTMIND_ENV'] = 'production';

      await expect(
        DeploymentRunner.run({ role: 'all' })
      ).rejects.toThrowError(PlatformConfigurationError);
    });
  });

  describe('3. DoctorCommand Diagnostic Accuracy & CLI Enforcement', () => {
    let app: CLIApplication;
    let stdoutLogs: string[];
    let stderrLogs: string[];
    let tempDir: string;

    beforeEach(() => {
      stdoutLogs = [];
      stderrLogs = [];
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-doc-test-'));
      app = CLIApplication.createDefault({
        stdout: (msg) => stdoutLogs.push(msg),
        stderr: (msg) => stderrLogs.push(msg),
      });
    });

    afterEach(() => {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup error
      }
    });

    it('reports FAIL and exits non-zero in production when master key is missing', async () => {
      delete process.env['PROJECTMIND_MASTER_KEY'];
      delete process.env['PROJECTMIND_SECRET_KEY'];
      delete process.env['JWT_SECRET'];
      process.env['NODE_ENV'] = 'production';

      const exitCode = await app.run(['doctor', '--workspace', tempDir, '--json']);
      expect(exitCode).toBe(CLIExitCode.GENERAL_FAILURE);

      const allLogs = [...stdoutLogs, ...stderrLogs].join('\n');
      const json = JSON.parse(allLogs);
      expect(json.success).toBe(false);
      const secCheck = json.data?.checks?.find((c: any) => c.name === 'Secret Configuration');
      expect(secCheck).toBeDefined();
      expect(secCheck.status).toBe('FAIL');
      expect(secCheck.message).toContain('Missing PROJECTMIND_MASTER_KEY');
    });

    it('reports FAIL and exits non-zero in production when master key matches known default', async () => {
      process.env['NODE_ENV'] = 'production';
      process.env['PROJECTMIND_MASTER_KEY'] = 'default-development-key';

      const exitCode = await app.run(['doctor', '--workspace', tempDir, '--json']);
      expect(exitCode).toBe(CLIExitCode.GENERAL_FAILURE);

      const allLogs = [...stdoutLogs, ...stderrLogs].join('\n');
      const json = JSON.parse(allLogs);
      expect(json.success).toBe(false);
      const secCheck = json.data?.checks?.find((c: any) => c.name === 'Secret Configuration');
      expect(secCheck.status).toBe('FAIL');
      expect(secCheck.message).toContain('matches a known insecure default');
    });

    it('reports FAIL and exits non-zero in production when master key is shorter than 32 characters', async () => {
      process.env['NODE_ENV'] = 'production';
      process.env['PROJECTMIND_MASTER_KEY'] = 'too-short-key';

      const exitCode = await app.run(['doctor', '--workspace', tempDir, '--json']);
      expect(exitCode).toBe(CLIExitCode.GENERAL_FAILURE);

      const allLogs = [...stdoutLogs, ...stderrLogs].join('\n');
      const json = JSON.parse(allLogs);
      expect(json.success).toBe(false);
      const secCheck = json.data?.checks?.find((c: any) => c.name === 'Secret Configuration');
      expect(secCheck.status).toBe('FAIL');
      expect(secCheck.message).toContain('shorter than 32 characters');
    });

    it('reports PASS and exits 0 in production when valid 32+ character key is provided', async () => {
      process.env['NODE_ENV'] = 'production';
      process.env['PROJECTMIND_MASTER_KEY'] = 'a-secure-production-key-with-sufficient-length-32+chars';

      const exitCode = await app.run(['doctor', '--workspace', tempDir, '--json']);
      expect(exitCode).toBe(CLIExitCode.SUCCESS);

      const json = JSON.parse(stdoutLogs.join('\n'));
      expect(json.success).toBe(true);
      const secCheck = json.data.checks.find((c: any) => c.name === 'Secret Configuration');
      expect(secCheck.status).toBe('PASS');
      expect(secCheck.message).toContain('Production master key configured securely');
    });

    it('reports PASS and exits 0 in development mode without explicit key', async () => {
      delete process.env['NODE_ENV'];
      delete process.env['PROJECTMIND_ENV'];
      delete process.env['PROJECTMIND_MASTER_KEY'];
      delete process.env['PROJECTMIND_SECRET_KEY'];
      delete process.env['JWT_SECRET'];

      const exitCode = await app.run(['doctor', '--workspace', tempDir, '--json']);
      expect(exitCode).toBe(CLIExitCode.SUCCESS);

      const json = JSON.parse(stdoutLogs.join('\n'));
      expect(json.success).toBe(true);
      const secCheck = json.data.checks.find((c: any) => c.name === 'Secret Configuration');
      expect(secCheck.status).toBe('PASS');
      expect(secCheck.message).toContain('Using default development key (development mode)');
    });
  });

  describe('4. Redis Configuration Consistency & Error Handling', () => {
    it('fails fast when Redis is enabled but no URL is provided', () => {
      expect(() => {
        PlatformConfigValidator.validate({
          redis: {
            enabled: true,
            url: '',
          },
        });
      }).toThrowError(/redis.url must be specified when redis is enabled/);
    });

    it('accepts valid configuration when Redis is disabled without URL', () => {
      const config = PlatformConfigValidator.validate({
        redis: {
          enabled: false,
        },
      });
      expect(config.redis.enabled).toBe(false);
    });

    it('successfully imports ioredis client from production dependencies', async () => {
      const ioredis = await import('ioredis');
      expect(ioredis).toBeDefined();
      const Redis = ioredis.default ?? ioredis;
      expect(typeof Redis).toBe('function');
    });
  });

  describe('5. Production Secret Fallback & Redis Health Integration (Remediation 3)', () => {
    it('accepts PROJECTMIND_SECRET_KEY fallback in production when valid (>= 32 chars and secure)', () => {
      delete process.env['PROJECTMIND_MASTER_KEY'];
      process.env['PROJECTMIND_ENV'] = 'production';
      process.env['PROJECTMIND_SECRET_KEY'] = 'c'.repeat(32);

      const config = PlatformConfigLoader.load();
      expect(config.security.masterKey).toBe('c'.repeat(32));
    });

    it('rejects PROJECTMIND_SECRET_KEY fallback in production when shorter than 32 characters', () => {
      delete process.env['PROJECTMIND_MASTER_KEY'];
      process.env['PROJECTMIND_ENV'] = 'production';
      process.env['PROJECTMIND_SECRET_KEY'] = 'too-short-secret-key-123';

      expect(() => {
        PlatformConfigLoader.load();
      }).toThrowError(/must be at least 32 characters/);
    });

    it('rejects PROJECTMIND_SECRET_KEY fallback in production when matching known insecure key', () => {
      delete process.env['PROJECTMIND_MASTER_KEY'];
      process.env['PROJECTMIND_ENV'] = 'production';
      process.env['PROJECTMIND_SECRET_KEY'] = 'default-development-key';

      expect(() => {
        PlatformConfigLoader.load();
      }).toThrowError(/matches a known insecure development default/);
    });

    it('prioritizes PROJECTMIND_MASTER_KEY over PROJECTMIND_SECRET_KEY when both are set', () => {
      process.env['PROJECTMIND_ENV'] = 'production';
      process.env['PROJECTMIND_MASTER_KEY'] = 'm'.repeat(32);
      process.env['PROJECTMIND_SECRET_KEY'] = 's'.repeat(32);

      const config = PlatformConfigLoader.load();
      expect(config.security.masterKey).toBe('m'.repeat(32));
    });

    it('treats empty PROJECTMIND_MASTER_KEY as missing rather than bypassing production security', () => {
      process.env['PROJECTMIND_ENV'] = 'production';
      process.env['PROJECTMIND_MASTER_KEY'] = '';
      delete process.env['PROJECTMIND_SECRET_KEY'];

      expect(() => {
        PlatformConfigLoader.load();
      }).toThrowError(/PROJECTMIND_MASTER_KEY is required in production/);
    });

    it('verifies ProductionBootstrap performs real probe on Redis and reports UNHEALTHY when unreachable', async () => {
      const platform = await ProductionBootstrap.bootstrap({
        disableSignalHandlers: true,
        configOverrides: {
          app: { env: 'development' },
          storage: { type: 'memory' },
          redis: {
            enabled: true,
            url: 'redis://127.0.0.1:63999',
            connectTimeoutMs: 500,
          },
        },
      });

      const report = await platform.getHealth();
      expect(report.components['REDIS']).toBeDefined();
      expect(report.components['REDIS']!.status).toBe('UNHEALTHY');
      expect(report.components['REDIS']!.message).toContain('failed');
      // Redis is registered as optional component in bootstrap, so overall status is DEGRADED rather than dead
      expect(report.status).toBe('DEGRADED');

      await platform.shutdown('test complete');
    });

    it('verifies ProductionBootstrap omits REDIS health component when Redis is disabled', async () => {
      const platform = await ProductionBootstrap.bootstrap({
        disableSignalHandlers: true,
        configOverrides: {
          app: { env: 'development' },
          storage: { type: 'memory' },
          redis: {
            enabled: false,
          },
        },
      });

      const report = await platform.getHealth();
      expect(report.components['REDIS']).toBeUndefined();
      expect(report.status).toBe('HEALTHY');

      await platform.shutdown('test complete');
    });
  });
});
