import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import Database from 'better-sqlite3';
import { StorageMigrationRunner } from '../../src/storage/migration/StorageMigrationRunner.js';

describe('Phase 10.5 Deployment - Storage Migration Runner', () => {
  const testDir = path.resolve(process.cwd(), '.projectmind_test_migrations');
  const dbPath = path.join(testDir, 'test_migrations.db');

  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    if (fs.existsSync(dbPath)) {
      fs.rmSync(dbPath, { force: true });
    }
  });

  afterEach(() => {
    try {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    } catch {
      // Ignore lock releases on Windows
    }
  });

  it('initializes migration and lock tables and reports clean initial status', async () => {
    const runner = new StorageMigrationRunner({
      databasePath: dbPath,
      environment: 'test',
    });

    const status = await runner.getStatus();
    expect(status.currentVersion).toBe(0);
    expect(status.latestAvailableVersion).toBe(3);
    expect(status.isUpToDate).toBe(false);
    expect(status.pendingMigrations.length).toBe(3);
  });

  it('acquires and releases cooperative advisory locks successfully', () => {
    const runner = new StorageMigrationRunner({
      databasePath: dbPath,
      environment: 'test',
      lockTimeoutMs: 5000,
    });

    const db = new Database(dbPath);
    try {
      const lock1 = runner.acquireLock(db, 'worker_1');
      expect(lock1).toBe(true);

      // Concurrent lock acquisition with another owner fails
      const lock2 = runner.acquireLock(db, 'worker_2');
      expect(lock2).toBe(false);

      // Release lock1
      runner.releaseLock(db, 'worker_1');

      // Now worker_2 can acquire the lock
      const lock3 = runner.acquireLock(db, 'worker_2');
      expect(lock3).toBe(true);

      runner.releaseLock(db, 'worker_2');
    } finally {
      db.close();
    }
  });

  it('applies migrations forward in sequence and records history durably', async () => {
    const runner = new StorageMigrationRunner({
      databasePath: dbPath,
      environment: 'test',
    });

    const result = await runner.runMigrations();
    expect(result.success).toBe(true);
    expect(result.appliedCount).toBe(3);
    expect(result.currentVersion).toBe(3);

    // Verify status is up-to-date
    const status = await runner.getStatus();
    expect(status.currentVersion).toBe(3);
    expect(status.isUpToDate).toBe(true);
    expect(status.pendingMigrations.length).toBe(0);

    // Verify tables created in SQLite directly
    const db = new Database(dbPath);
    try {
      const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all() as { name: string }[];
      const tableNames = new Set(tables.map((t) => t.name));
      expect(tableNames.has('pm_schema_migrations')).toBe(true);
      expect(tableNames.has('pm_durable_jobs')).toBe(true);
      expect(tableNames.has('pm_event_outbox')).toBe(true);
      expect(tableNames.has('pm_event_inbox')).toBe(true);
    } finally {
      db.close();
    }
  });

  it('executes migrations idempotently when run multiple times', async () => {
    const runner = new StorageMigrationRunner({
      databasePath: dbPath,
      environment: 'test',
    });

    const firstRun = await runner.runMigrations();
    expect(firstRun.appliedCount).toBe(3);

    const secondRun = await runner.runMigrations();
    expect(secondRun.success).toBe(true);
    expect(secondRun.appliedCount).toBe(0);
    expect(secondRun.currentVersion).toBe(3);
  });
});
