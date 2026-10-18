import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import Database from 'better-sqlite3';
import {
  SqliteDatabaseBackupManager,
  type DatabaseBackupRecord,
} from '../../src/storage/recovery/SqliteDatabaseBackupManager.js';
import { StorageCoreError } from '../../src/storage/types/StorageErrors.js';

describe('SqliteDatabaseBackupManager - High Availability & Backup Integrity', () => {
  let tempDir: string;
  let testDbPath: string;
  let backupDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-dr-test-'));
    testDbPath = path.join(tempDir, 'test.db');
    backupDir = path.join(tempDir, 'backups');

    // Create a real SQLite database with sample schema and data
    const db = new Database(testDbPath);
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec(`
      CREATE TABLE pm_schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
      INSERT INTO pm_schema_migrations VALUES (3, 'phase10_tables', 'APPLIED', datetime('now'));

      CREATE TABLE repositories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL
      );
      INSERT INTO repositories VALUES ('repo-1', 'ProjectMind', '/workspace');

      CREATE TABLE memories (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL
      );
      INSERT INTO memories VALUES ('mem-1', 'Architectural decision: Use SQLite WAL mode');
    `);
    db.close();
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignored
    }
  });

  it('creates a consistent online backup with SHA-256 hash and standalone metadata', async () => {
    const manager = new SqliteDatabaseBackupManager({
      databasePath: testDbPath,
      backupDirectory: backupDir,
      applicationVersion: '10.7.0',
    });

    const record = await manager.createBackup({
      description: 'Test recovery point',
    });

    expect(record.status).toBe('COMPLETED');
    expect(record.backupId).toMatch(/^bkp_sqlite_/);
    expect(record.schemaVersion).toBe(3);
    expect(record.applicationVersion).toBe('10.7.0');
    expect(record.sizeBytes).toBeGreaterThan(0);
    expect(record.sha256Checksum).toHaveLength(64);
    expect(record.integrityCheckResult).toBe('ok');

    // Verify backup file exists
    expect(fs.existsSync(record.backupPath)).toBe(true);

    // Verify standalone metadata JSON exists and is identical
    const metadataPath = path.join(backupDir, `${record.backupId}.json`);
    expect(fs.existsSync(metadataPath)).toBe(true);
    const stored = JSON.parse(fs.readFileSync(metadataPath, 'utf8')) as DatabaseBackupRecord;
    expect(stored.backupId).toBe(record.backupId);
    expect(stored.sha256Checksum).toBe(record.sha256Checksum);

    // Verify backup content is a valid standalone SQLite database
    const probe = new Database(record.backupPath, { readonly: true });
    const repoRow: any = probe.prepare("SELECT name FROM repositories WHERE id = 'repo-1'").get();
    expect(repoRow.name).toBe('ProjectMind');
    const memRow: any = probe.prepare("SELECT content FROM memories WHERE id = 'mem-1'").get();
    expect(memRow.content).toContain('Architectural decision');
    probe.close();
  });

  it('detects byte modification or corruption and rejects corrupted backups', async () => {
    const manager = new SqliteDatabaseBackupManager({
      databasePath: testDbPath,
      backupDirectory: backupDir,
    });

    const record = await manager.createBackup();

    // 1. Initial verification passes
    const initialVerify = await manager.verifyBackup(record.backupId);
    expect(initialVerify.isValid).toBe(true);
    expect(initialVerify.errors).toHaveLength(0);

    // 2. Corrupt the backup database file by mutating internal bytes
    const buffer = fs.readFileSync(record.backupPath);
    buffer.write('CORRUPTED_BYTES_HERE', 100);
    fs.writeFileSync(record.backupPath, buffer);

    // 3. Verification must fail on checksum mismatch and mark status CORRUPTED
    const corruptedVerify = await manager.verifyBackup(record.backupId);
    expect(corruptedVerify.isValid).toBe(false);
    expect(corruptedVerify.errors.length).toBeGreaterThan(0);
    expect(corruptedVerify.errors.some((e) => e.includes('Checksum mismatch'))).toBe(true);

    const reloaded = await manager.inspectBackup(record.backupId);
    expect(reloaded?.status).toBe('CORRUPTED');
  });

  it('prevents concurrent backup executions on the same manager', async () => {
    const manager = new SqliteDatabaseBackupManager({
      databasePath: testDbPath,
      backupDirectory: backupDir,
    });

    const p1 = manager.createBackup();
    const p2 = manager.createBackup();

    const results = await Promise.allSettled([p1, p2]);
    const rejected = results.filter((r) => r.status === 'rejected');
    const fulfilled = results.filter((r) => r.status === 'fulfilled');

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    if (rejected[0]?.status === 'rejected') {
      expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(StorageCoreError);
      expect((rejected[0] as PromiseRejectedResult).reason.message).toContain('already in progress');
    }
  });

  it('strictly protects the last verified recoverable copy during retention cleanup', async () => {
    const manager = new SqliteDatabaseBackupManager({
      databasePath: testDbPath,
      backupDirectory: backupDir,
    });

    // Create 1 valid backup
    const b1 = await manager.createBackup({ description: 'Only backup' });

    // Request retention cleanup with maxBackupsToRetain: 0 and maxAgeDays: 0 (aggressive purge)
    const cleanup = await manager.applyRetentionPolicy({
      maxBackupsToRetain: 0,
      maxAgeDays: 0,
    });

    // GUARANTEE: Must NOT delete the last remaining verified backup!
    expect(cleanup.deletedCount).toBe(0);
    expect(cleanup.retainedCount).toBe(1);

    const remaining = await manager.listBackups();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.backupId).toBe(b1.backupId);
    expect(fs.existsSync(b1.backupPath)).toBe(true);

    // Even explicit deleteBackup without force must refuse
    const deleted = await manager.deleteBackup(b1.backupId, false);
    expect(deleted).toBe(false);
    expect(fs.existsSync(b1.backupPath)).toBe(true);
  });

  it('prunes older backups when newer verified backups exist', async () => {
    const manager = new SqliteDatabaseBackupManager({
      databasePath: testDbPath,
      backupDirectory: backupDir,
    });

    // Create 3 backups
    const b1 = await manager.createBackup({ description: 'Backup 1' });
    const b2 = await manager.createBackup({ description: 'Backup 2' });
    const b3 = await manager.createBackup({ description: 'Backup 3' });

    const all = await manager.listBackups();
    expect(all).toHaveLength(3);

    // Apply policy: retain only 2
    const cleanup = await manager.applyRetentionPolicy({
      maxBackupsToRetain: 2,
    });

    expect(cleanup.deletedCount).toBe(1);
    expect(cleanup.deletedBackupIds).toContain(b1.backupId);

    const remaining = await manager.listBackups();
    expect(remaining).toHaveLength(2);
    expect(remaining.map((b) => b.backupId)).toEqual([b3.backupId, b2.backupId]);
  });
});
