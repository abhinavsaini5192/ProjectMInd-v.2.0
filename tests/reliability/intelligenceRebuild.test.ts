import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import {
  IntelligenceRebuildManager,
  KNOWN_TABLE_CLASSIFICATIONS,
} from '../../src/storage/recovery/IntelligenceRebuildManager.js';

describe('IntelligenceRebuildManager - Derived State Recovery & Authoritative Isolation', () => {
  let tempDir: string;
  let testDbPath: string;
  let repoDir: string;
  let manager: IntelligenceRebuildManager;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-rebuild-test-'));
    testDbPath = path.join(tempDir, 'projectmind.db');
    repoDir = path.join(tempDir, 'repo');
    fs.mkdirSync(repoDir, { recursive: true });

    manager = new IntelligenceRebuildManager();

    // Create a sample repository file
    const sampleFile = path.join(repoDir, 'index.ts');
    fs.writeFileSync(sampleFile, 'export const greeting = "hello";');
    const hash = crypto.createHash('sha256').update('export const greeting = "hello";').digest('hex');

    // Create database with both authoritative and derived tables
    const db = new Database(testDbPath);
    db.exec(`
      -- Authoritative Tables
      CREATE TABLE repositories (id TEXT PRIMARY KEY, name TEXT);
      INSERT INTO repositories VALUES ('repo-1', 'Main');

      CREATE TABLE memories (id TEXT PRIMARY KEY, content TEXT);
      INSERT INTO memories VALUES ('mem-1', 'Critical user memory');

      CREATE TABLE settings (setting_key TEXT PRIMARY KEY, setting_value TEXT, scope TEXT);
      INSERT INTO settings VALUES ('theme', 'dark', 'user');

      CREATE TABLE pm_durable_jobs (job_id TEXT PRIMARY KEY, type TEXT, status TEXT);
      INSERT INTO pm_durable_jobs VALUES ('job-1', 'INDEXING', 'PENDING');

      -- Derived Reconstructible Tables
      CREATE TABLE file_metadata (
        file_path TEXT PRIMARY KEY,
        language TEXT,
        size_bytes INTEGER,
        checksum TEXT,
        last_analyzed_at DATETIME
      );
      INSERT INTO file_metadata VALUES ('index.ts', 'typescript', 32, '${hash}', datetime('now'));

      CREATE TABLE symbols (
        symbol_id TEXT PRIMARY KEY,
        file_path TEXT,
        name TEXT,
        type TEXT,
        line_number INTEGER
      );
      INSERT INTO symbols VALUES ('sym-1', 'index.ts', 'greeting', 'constant', 1);

      -- Ephemeral Cache Table
      CREATE TABLE cache_entries (
        key TEXT PRIMARY KEY,
        data BLOB,
        expires_at DATETIME
      );
      INSERT INTO cache_entries VALUES ('cache-1', 'sample-blob', datetime('now', '-1 day'));
      INSERT INTO cache_entries VALUES ('cache-2', 'active-blob', datetime('now', '+1 day'));
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

  it('classifies authoritative vs derived and ephemeral state accurately', () => {
    const classifications = manager.getClassifications();
    expect(classifications).toEqual(KNOWN_TABLE_CLASSIFICATIONS);

    const authoritative = classifications.filter((c) => c.isAuthoritative).map((c) => c.tableName);
    const derived = classifications.filter((c) => !c.isAuthoritative).map((c) => c.tableName);

    expect(authoritative).toContain('repositories');
    expect(authoritative).toContain('memories');
    expect(authoritative).toContain('settings');
    expect(authoritative).toContain('pm_durable_jobs');
    expect(authoritative).toContain('pm_event_outbox');

    expect(derived).toContain('file_metadata');
    expect(derived).toContain('symbols');
    expect(derived).toContain('cache_entries');
  });

  it('detects index staleness when repository files are modified or missing', async () => {
    // 1. Initial report when files match
    const initialReport = await manager.detectStaleness(testDbPath, repoDir);
    expect(initialReport.totalIndexedFiles).toBe(1);
    expect(initialReport.staleFilesCount).toBe(0);
    expect(initialReport.missingFilesCount).toBe(0);
    expect(initialReport.expiredCacheEntriesCount).toBe(1); // One expired cache entry

    // 2. Modify repository file
    const sampleFile = path.join(repoDir, 'index.ts');
    fs.writeFileSync(sampleFile, 'export const greeting = "modified";');

    const staleReport = await manager.detectStaleness(testDbPath, repoDir);
    expect(staleReport.isStale).toBe(true);
    expect(staleReport.staleFilesCount).toBe(1);
    expect(staleReport.recommendations.some((r) => r.includes('changed since last analysis'))).toBe(true);

    // 3. Delete repository file
    fs.unlinkSync(sampleFile);
    const missingReport = await manager.detectStaleness(testDbPath, repoDir);
    expect(missingReport.isStale).toBe(true);
    expect(missingReport.missingFilesCount).toBe(1);
    expect(missingReport.recommendations.some((r) => r.includes('no longer exist on disk'))).toBe(true);
  });

  it('clears ephemeral cache entries without touching any authoritative state', async () => {
    const cleared = await manager.clearEphemeralCaches(testDbPath);
    expect(cleared).toBe(2);

    const db = new Database(testDbPath, { readonly: true });
    // Cache entries should be 0
    const cacheCount: any = db.prepare('SELECT count(*) as cnt FROM cache_entries').get();
    expect(cacheCount.cnt).toBe(0);

    // Authoritative tables must remain intact!
    const memCount: any = db.prepare('SELECT count(*) as cnt FROM memories').get();
    expect(memCount.cnt).toBe(1);
    const repoCount: any = db.prepare('SELECT count(*) as cnt FROM repositories').get();
    expect(repoCount.cnt).toBe(1);
    const jobCount: any = db.prepare('SELECT count(*) as cnt FROM pm_durable_jobs').get();
    expect(jobCount.cnt).toBe(1);
    const settingsCount: any = db.prepare('SELECT count(*) as cnt FROM settings').get();
    expect(settingsCount.cnt).toBe(1);

    db.close();
  });

  it('resets derived indexes cleanly while preserving all authoritative tables', async () => {
    const result = await manager.resetDerivedIndexes(testDbPath);
    expect(result.symbolsCleared).toBe(1);
    expect(result.filesCleared).toBe(1);

    const db = new Database(testDbPath, { readonly: true });
    const symCount: any = db.prepare('SELECT count(*) as cnt FROM symbols').get();
    expect(symCount.cnt).toBe(0);
    const fileCount: any = db.prepare('SELECT count(*) as cnt FROM file_metadata').get();
    expect(fileCount.cnt).toBe(0);

    // Authoritative tables must still be untouched!
    const memRow: any = db.prepare("SELECT content FROM memories WHERE id = 'mem-1'").get();
    expect(memRow.content).toBe('Critical user memory');
    const jobRow: any = db.prepare("SELECT status FROM pm_durable_jobs WHERE job_id = 'job-1'").get();
    expect(jobRow.status).toBe('PENDING');

    db.close();
  });
});
