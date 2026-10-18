import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import Database from 'better-sqlite3';
import { CLIApplication } from '../../src/cli/core/CLIApplication.js';
import { CLIExitCode } from '../../src/cli/core/CLIExitCode.js';

describe('CLI BackupCommand Suite - Operational DR & Recovery Procedures', () => {
  let app: CLIApplication;
  let stdoutLogs: string[];
  let stderrLogs: string[];
  let tempDir: string;
  let dbDir: string;
  let defaultDbPath: string;

  beforeEach(() => {
    stdoutLogs = [];
    stderrLogs = [];
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'projectmind-cli-backup-test-'));

    dbDir = path.join(tempDir, '.projectmind', 'data');
    fs.mkdirSync(dbDir, { recursive: true });
    defaultDbPath = path.join(dbDir, 'projectmind.db');

    // Create a real SQLite database for testing
    const db = new Database(defaultDbPath);
    db.exec(`
      CREATE TABLE repositories (id TEXT PRIMARY KEY, name TEXT);
      INSERT INTO repositories VALUES ('repo-1', 'ProjectMind-CLI');

      CREATE TABLE cache_entries (key TEXT PRIMARY KEY, data BLOB, expires_at DATETIME);
      INSERT INTO cache_entries VALUES ('test-key', 'cached-data', datetime('now', '-1 hour'));
    `);
    db.close();

    app = CLIApplication.createDefault({
      stdout: (msg) => stdoutLogs.push(msg),
      stderr: (msg) => stderrLogs.push(msg),
    });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignored
    }
  });

  it('projectmind backup create - creates consistent backup and returns 0 exit code', async () => {
    const exitCode = await app.run([
      'backup',
      'create',
      '--workspace',
      tempDir,
      '--description',
      'CLI Automated Test Backup',
      '--json',
    ]);

    expect(exitCode).toBe(CLIExitCode.SUCCESS);
    const json = JSON.parse(stdoutLogs.join('\n'));
    expect(json.success).toBe(true);
    expect(json.data.backupId).toMatch(/^bkp_sqlite_/);
    expect(json.data.sha256Checksum).toHaveLength(64);
  });

  it('projectmind backup list - enumerates existing backups', async () => {
    // 1. Create a backup first
    await app.run(['backup', 'create', '--workspace', tempDir]);
    stdoutLogs = [];

    // 2. List backups
    const exitCode = await app.run(['backup', 'list', '--workspace', tempDir, '--json']);
    expect(exitCode).toBe(CLIExitCode.SUCCESS);

    const json = JSON.parse(stdoutLogs.join('\n'));
    expect(json.success).toBe(true);
    expect(json.data.count).toBe(1);
    expect(json.data.backups[0].backupId).toMatch(/^bkp_sqlite_/);
  });

  it('projectmind backup verify - verifies SHA-256 and internal database integrity', async () => {
    // 1. Create backup
    await app.run(['backup', 'create', '--workspace', tempDir, '--json']);
    const createJson = JSON.parse(stdoutLogs.join('\n'));
    const backupId = createJson.data.backupId;
    stdoutLogs = [];

    // 2. Verify backup
    const exitCode = await app.run(['backup', 'verify', backupId, '--workspace', tempDir, '--json']);
    expect(exitCode).toBe(CLIExitCode.SUCCESS);

    const verifyJson = JSON.parse(stdoutLogs.join('\n'));
    expect(verifyJson.success).toBe(true);
    expect(verifyJson.data.isValid).toBe(true);
    expect(verifyJson.data.backupId).toBe(backupId);
  });

  it('projectmind backup restore - blocks accidental production overwrite unless explicitly confirmed', async () => {
    // 1. Create backup
    await app.run(['backup', 'create', '--workspace', tempDir, '--json']);
    const createJson = JSON.parse(stdoutLogs.join('\n'));
    const backupId = createJson.data.backupId;
    stdoutLogs = [];
    stderrLogs = [];

    // 2. Attempt restore pointing to active database path WITHOUT confirm flag
    const exitCode = await app.run([
      'backup',
      'restore',
      backupId,
      '--workspace',
      tempDir,
      '--target',
      defaultDbPath,
      '--authorized-by',
      'ops-admin',
      '--json',
    ]);

    expect(exitCode).toBe(CLIExitCode.GENERAL_FAILURE);
    const errJson = JSON.parse(stderrLogs.join('\n'));
    expect(errJson.success).toBe(false);
    expect(errJson.errors.some((e: string) => e.includes('Destructive production restore is blocked'))).toBe(true);
  });

  it('projectmind backup restore - succeeds into isolated target environment', async () => {
    // 1. Create backup
    await app.run(['backup', 'create', '--workspace', tempDir, '--json']);
    const createJson = JSON.parse(stdoutLogs.join('\n'));
    const backupId = createJson.data.backupId;
    stdoutLogs = [];

    const isolatedTarget = path.join(tempDir, 'isolated_restored.db');

    // 2. Restore to isolated target
    const exitCode = await app.run([
      'backup',
      'restore',
      backupId,
      '--workspace',
      tempDir,
      '--target',
      isolatedTarget,
      '--authorized-by',
      'qa-engineer',
      '--json',
    ]);

    expect(exitCode).toBe(CLIExitCode.SUCCESS);
    const restoreJson = JSON.parse(stdoutLogs.join('\n'));
    expect(restoreJson.success).toBe(true);
    expect(restoreJson.data.integrityCheckResult).toBe('ok');
    expect(restoreJson.data.foreignKeysValid).toBe(true);
    expect(fs.existsSync(isolatedTarget)).toBe(true);
  });

  it('projectmind backup prune-cache - clears transient cache without data loss', async () => {
    const exitCode = await app.run(['backup', 'prune-cache', '--workspace', tempDir, '--json']);
    expect(exitCode).toBe(CLIExitCode.SUCCESS);

    const json = JSON.parse(stdoutLogs.join('\n'));
    expect(json.success).toBe(true);
    expect(json.data.cleared).toBe(1);

    // Repositories table must still be intact
    const db = new Database(defaultDbPath, { readonly: true });
    const row: any = db.prepare('SELECT count(*) as cnt FROM repositories').get();
    expect(row.cnt).toBe(1);
    db.close();
  });
});
