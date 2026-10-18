import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import Database from 'better-sqlite3';
import { SqliteDatabaseBackupManager } from '../../src/storage/recovery/SqliteDatabaseBackupManager.js';
import {
  SqliteDatabaseRestoreManager,
  type SqliteRestoreReport,
} from '../../src/storage/recovery/SqliteDatabaseRestoreManager.js';
import { StorageCoreError } from '../../src/storage/types/StorageErrors.js';

describe('SqliteDatabaseRestoreManager - Safe Restoration & Failure Protection', () => {
  let tempDir: string;
  let activeDbPath: string;
  let isolatedTargetDbPath: string;
  let backupDir: string;
  let backupManager: SqliteDatabaseBackupManager;
  let restoreManager: SqliteDatabaseRestoreManager;
  let validBackupId: string;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-restore-test-'));
    activeDbPath = path.join(tempDir, 'active_production.db');
    isolatedTargetDbPath = path.join(tempDir, 'isolated_target.db');
    backupDir = path.join(tempDir, 'backups');

    // Populate active database
    const db = new Database(activeDbPath);
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec(`
      CREATE TABLE pm_schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
      INSERT INTO pm_schema_migrations VALUES (4, 'schema_v4', 'APPLIED', datetime('now'));

      CREATE TABLE repositories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL
      );
      INSERT INTO repositories VALUES ('repo-1', 'ProjectMind-Core', '/app');

      CREATE TABLE pm_durable_jobs (
        job_id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        status TEXT NOT NULL
      );
      INSERT INTO pm_durable_jobs VALUES ('job-101', 'CODE_INDEX', 'COMPLETED');
    `);
    db.close();

    backupManager = new SqliteDatabaseBackupManager({
      databasePath: activeDbPath,
      backupDirectory: backupDir,
      applicationVersion: '10.7.0',
    });

    restoreManager = new SqliteDatabaseRestoreManager({
      backupDirectory: backupDir,
      defaultActiveDatabasePath: activeDbPath,
      currentApplicationVersion: '10.7.0',
    });

    const bkp = await backupManager.createBackup({ description: 'Baseline backup' });
    validBackupId = bkp.backupId;
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignored
    }
  });

  it('rejects restore if operational authorization is missing', async () => {
    await expect(
      restoreManager.executeRestore({
        backupId: validBackupId,
        targetDatabasePath: isolatedTargetDbPath,
        authorizedBy: '', // Missing
      })
    ).rejects.toThrow(StorageCoreError);
  });

  it('safely blocks destructive restore over the active production database by default', async () => {
    // Attempting to restore directly to activeDbPath without confirmProductionOverwrite
    const validation = await restoreManager.validateRestore({
      backupId: validBackupId,
      targetDatabasePath: activeDbPath,
      authorizedBy: 'dev-operator',
      confirmProductionOverwrite: false, // Not confirmed
      activeDatabasePath: activeDbPath,
    });

    expect(validation.canRestore).toBe(false);
    expect(validation.isProductionTarget).toBe(true);
    expect(validation.errors.some((e) => e.includes('Destructive production restore is blocked'))).toBe(true);

    await expect(
      restoreManager.executeRestore({
        backupId: validBackupId,
        targetDatabasePath: activeDbPath,
        authorizedBy: 'dev-operator',
        confirmProductionOverwrite: false,
        activeDatabasePath: activeDbPath,
      })
    ).rejects.toThrow(StorageCoreError);
  });

  it('restores successfully into an isolated target with full integrity and constraint verification', async () => {
    const report: SqliteRestoreReport = await restoreManager.executeRestore({
      backupId: validBackupId,
      targetDatabasePath: isolatedTargetDbPath,
      authorizedBy: 'security-officer',
      activeDatabasePath: activeDbPath,
    });

    expect(report.success).toBe(true);
    expect(report.isProductionOverwrite).toBe(false);
    expect(report.integrityCheckResult).toBe('ok');
    expect(report.foreignKeysValid).toBe(true);
    expect(report.schemaVersion).toBe(4);
    expect(report.tablesFound).toContain('repositories');
    expect(report.tablesFound).toContain('pm_durable_jobs');
    expect(report.recordCounts['repositories']).toBe(1);
    expect(report.recordCounts['pm_durable_jobs']).toBe(1);

    // Verify restored file independently
    const probe = new Database(isolatedTargetDbPath, { readonly: true });
    const repoRow: any = probe.prepare("SELECT name FROM repositories WHERE id = 'repo-1'").get();
    expect(repoRow.name).toBe('ProjectMind-Core');
    probe.close();
  });

  it('creates a pre-restore safety copy and cleans up stale WAL/SHM when target exists', async () => {
    // 1. Create an existing database at target path with old dummy data
    const existingDb = new Database(isolatedTargetDbPath);
    existingDb.exec('PRAGMA journal_mode = WAL;');
    existingDb.exec("CREATE TABLE dummy (id INT); INSERT INTO dummy VALUES (99);");
    existingDb.close();

    // Create stale wal and shm files
    const targetWal = `${isolatedTargetDbPath}-wal`;
    const targetShm = `${isolatedTargetDbPath}-shm`;
    fs.writeFileSync(targetWal, 'stale-wal-frame');
    fs.writeFileSync(targetShm, 'stale-shm-index');

    expect(fs.existsSync(targetWal)).toBe(true);
    expect(fs.existsSync(targetShm)).toBe(true);

    // 2. Perform restore over this existing target
    const report = await restoreManager.executeRestore({
      backupId: validBackupId,
      targetDatabasePath: isolatedTargetDbPath,
      authorizedBy: 'emergency-operator',
      activeDatabasePath: activeDbPath,
    });

    expect(report.success).toBe(true);
    expect(report.preRestoreSafetyCopyPath).toBeDefined();
    expect(fs.existsSync(report.preRestoreSafetyCopyPath!)).toBe(true);

    // Verify safety copy contains the old dummy table
    const safetyDb = new Database(report.preRestoreSafetyCopyPath!, { readonly: true });
    const checkOld: any = safetyDb.prepare('SELECT count(*) as cnt FROM dummy').get();
    expect(checkOld.cnt).toBe(1);
    safetyDb.close();

    // Verify restored database has the real restored schema and no dummy table
    const restoredDb = new Database(isolatedTargetDbPath, { readonly: true });
    const checkNew: any = restoredDb.prepare("SELECT name FROM sqlite_master WHERE name = 'dummy'").get();
    expect(checkNew).toBeUndefined();
    restoredDb.close();

    // Verify stale WAL/SHM were replaced/cleaned up (content is not the stale payload)
    if (fs.existsSync(targetWal)) {
      expect(fs.readFileSync(targetWal, 'utf8')).not.toBe('stale-wal-frame');
    }
    if (fs.existsSync(targetShm)) {
      expect(fs.readFileSync(targetShm, 'utf8')).not.toBe('stale-shm-index');
    }
  });

  it('refuses to restore corrupted backup artifacts', async () => {
    // Mutate the backup file
    const metaPath = path.join(backupDir, `${validBackupId}.json`);
    const metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    const bkpFile = metadata.backupPath;

    const content = fs.readFileSync(bkpFile);
    content.write('INJECTED_CORRUPTED_BYTES', 50);
    fs.writeFileSync(bkpFile, content);

    // Validation must fail
    const validation = await restoreManager.validateRestore({
      backupId: validBackupId,
      targetDatabasePath: isolatedTargetDbPath,
      authorizedBy: 'test-user',
    });

    expect(validation.canRestore).toBe(false);
    expect(validation.errors.some((e) => e.includes('checksum mismatch'))).toBe(true);

    // Restore must reject
    await expect(
      restoreManager.executeRestore({
        backupId: validBackupId,
        targetDatabasePath: isolatedTargetDbPath,
        authorizedBy: 'test-user',
      })
    ).rejects.toThrow(StorageCoreError);
  });
});
