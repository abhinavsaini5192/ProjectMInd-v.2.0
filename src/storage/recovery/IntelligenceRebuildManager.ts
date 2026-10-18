import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import type { ILogger } from '../../workspace/interfaces/ILogger.js';
import type { RecoveryTelemetry } from '../../observability/instrumentation/RecoveryTelemetry.js';
import { StorageCoreError } from '../types/StorageErrors.js';

export type IntelligenceDataCategory = 'AUTHORITATIVE' | 'DERIVED_RECONSTRUCTIBLE' | 'EPHEMERAL_CACHE';

export interface TableClassification {
  readonly tableName: string;
  readonly category: IntelligenceDataCategory;
  readonly description: string;
  readonly isAuthoritative: boolean;
  readonly canRebuild: boolean;
}

export const KNOWN_TABLE_CLASSIFICATIONS: readonly TableClassification[] = [
  // Authoritative State (Must be preserved, backed up, and restored)
  {
    tableName: 'repositories',
    category: 'AUTHORITATIVE',
    description: 'Registered repositories, paths, and workspace bindings',
    isAuthoritative: true,
    canRebuild: false,
  },
  {
    tableName: 'workspace_metadata',
    category: 'AUTHORITATIVE',
    description: 'Workspace identity, version, and operational settings',
    isAuthoritative: true,
    canRebuild: false,
  },
  {
    tableName: 'settings',
    category: 'AUTHORITATIVE',
    description: 'User, project, and runtime configuration settings',
    isAuthoritative: true,
    canRebuild: false,
  },
  {
    tableName: 'memories',
    category: 'AUTHORITATIVE',
    description: 'Persistent agent learnings, architectural memories, and context rules',
    isAuthoritative: true,
    canRebuild: false,
  },
  {
    tableName: 'memory_history',
    category: 'AUTHORITATIVE',
    description: 'Audit history of memory revisions and adjustments',
    isAuthoritative: true,
    canRebuild: false,
  },
  {
    tableName: 'pm_durable_jobs',
    category: 'AUTHORITATIVE',
    description: 'Durable background job queue states, payloads, and progress',
    isAuthoritative: true,
    canRebuild: false,
  },
  {
    tableName: 'pm_job_attempts',
    category: 'AUTHORITATIVE',
    description: 'Execution attempts, outcomes, and failure audit trails',
    isAuthoritative: true,
    canRebuild: false,
  },
  {
    tableName: 'pm_job_dead_letter',
    category: 'AUTHORITATIVE',
    description: 'Dead-letter queue records for exhausted or poison jobs',
    isAuthoritative: true,
    canRebuild: false,
  },
  {
    tableName: 'pm_event_outbox',
    category: 'AUTHORITATIVE',
    description: 'Transactional event outbox pending or dispatched events',
    isAuthoritative: true,
    canRebuild: false,
  },
  {
    tableName: 'pm_event_inbox',
    category: 'AUTHORITATIVE',
    description: 'Transactional event inbox deduplication and idempotency records',
    isAuthoritative: true,
    canRebuild: false,
  },
  {
    tableName: 'pm_schema_migrations',
    category: 'AUTHORITATIVE',
    description: 'Applied database migration history and version tracking',
    isAuthoritative: true,
    canRebuild: false,
  },

  // Derived Reconstructible Intelligence (Can be safely re-extracted from source files)
  {
    tableName: 'file_metadata',
    category: 'DERIVED_RECONSTRUCTIBLE',
    description: 'Extracted file language, byte size, hash, and analysis timestamp',
    isAuthoritative: false,
    canRebuild: true,
  },
  {
    tableName: 'symbols',
    category: 'DERIVED_RECONSTRUCTIBLE',
    description: 'Extracted AST symbol definitions, identifiers, and line numbers',
    isAuthoritative: false,
    canRebuild: true,
  },

  // Ephemeral Caches (Can be safely wiped at any time)
  {
    tableName: 'cache_entries',
    category: 'EPHEMERAL_CACHE',
    description: 'Ephemeral context cache entries and transient query results',
    isAuthoritative: false,
    canRebuild: true,
  },
];

export interface IntelligenceStalenessReport {
  readonly checkedAt: number;
  readonly databasePath: string;
  readonly totalIndexedFiles: number;
  readonly staleFilesCount: number;
  readonly missingFilesCount: number;
  readonly totalSymbols: number;
  readonly expiredCacheEntriesCount: number;
  readonly isStale: boolean;
  readonly recommendations: readonly string[];
}

export interface RebuildDerivedIntelligenceResult {
  readonly startedAt: number;
  readonly completedAt: number;
  readonly durationMs: number;
  readonly clearedCacheEntries: number;
  readonly clearedSymbols: number;
  readonly clearedFiles: number;
  readonly rebuiltFiles: number;
  readonly rebuiltSymbols: number;
  readonly message: string;
}

export interface IntelligenceRebuildManagerOptions {
  readonly logger?: ILogger | undefined;
  readonly telemetry?: RecoveryTelemetry | undefined;
}

export class IntelligenceRebuildManager {
  private readonly logger?: ILogger | undefined;
  private readonly telemetry?: RecoveryTelemetry | undefined;

  constructor(options: IntelligenceRebuildManagerOptions = {}) {
    this.logger = options.logger;
    this.telemetry = options.telemetry;
  }

  /**
   * Returns classification for all recognized tables in ProjectMind.
   */
  public getClassifications(): readonly TableClassification[] {
    return KNOWN_TABLE_CLASSIFICATIONS;
  }

  /**
   * Evaluates whether derived intelligence indexes (symbols, file_metadata) are
   * stale compared to the actual source files on disk.
   */
  public async detectStaleness(
    databasePath: string,
    repositoryRootPath?: string
  ): Promise<IntelligenceStalenessReport> {
    const checkedAt = Date.now();
    const resolvedDb = path.resolve(databasePath);

    if (!fs.existsSync(resolvedDb)) {
      throw new StorageCoreError(`Database file not found at '${resolvedDb}'`);
    }

    const db = new Database(resolvedDb, { readonly: true, timeout: 5000 });
    try {
      let totalIndexedFiles = 0;
      let staleFilesCount = 0;
      let missingFilesCount = 0;
      let totalSymbols = 0;
      let expiredCacheEntriesCount = 0;
      const recommendations: string[] = [];

      // 1. Check file_metadata and symbols if they exist
      const hasFileMetadata = db
        .prepare("SELECT count(*) as cnt FROM sqlite_master WHERE type = 'table' AND name = 'file_metadata'")
        .get() as any;

      if (hasFileMetadata?.cnt > 0) {
        const fileRows = db.prepare('SELECT file_path, checksum FROM file_metadata').all() as Array<{
          file_path: string;
          checksum: string;
        }>;
        totalIndexedFiles = fileRows.length;

        for (const f of fileRows) {
          const targetFile = repositoryRootPath ? path.resolve(repositoryRootPath, f.file_path) : f.file_path;
          if (!fs.existsSync(targetFile)) {
            missingFilesCount++;
          } else {
            try {
              const currentContent = fs.readFileSync(targetFile);
              const currentHash = crypto.createHash('sha256').update(currentContent).digest('hex');
              if (currentHash !== f.checksum) {
                staleFilesCount++;
              }
            } catch {
              // Could not read file
            }
          }
        }
      }

      const hasSymbols = db
        .prepare("SELECT count(*) as cnt FROM sqlite_master WHERE type = 'table' AND name = 'symbols'")
        .get() as any;
      if (hasSymbols?.cnt > 0) {
        const symbolRow = db.prepare('SELECT count(*) as cnt FROM symbols').get() as any;
        totalSymbols = Number(symbolRow?.cnt ?? 0);
      }

      // 2. Check expired cache entries
      const hasCache = db
        .prepare("SELECT count(*) as cnt FROM sqlite_master WHERE type = 'table' AND name = 'cache_entries'")
        .get() as any;
      if (hasCache?.cnt > 0) {
        const cacheRow = db
          .prepare(
            "SELECT count(*) as cnt FROM cache_entries WHERE expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP"
          )
          .get() as any;
        expiredCacheEntriesCount = Number(cacheRow?.cnt ?? 0);
      }

      const isStale = staleFilesCount > 0 || missingFilesCount > 0 || expiredCacheEntriesCount > 10;

      if (missingFilesCount > 0) {
        recommendations.push(
          `${missingFilesCount} indexed files no longer exist on disk. Run index reconciliation to prune orphaned symbols.`
        );
      }
      if (staleFilesCount > 0) {
        recommendations.push(
          `${staleFilesCount} indexed files have changed since last analysis. Trigger a background rebuild of derived intelligence.`
        );
      }
      if (expiredCacheEntriesCount > 0) {
        recommendations.push(
          `${expiredCacheEntriesCount} cache entries are expired. Ephemeral caches can be safely pruned.`
        );
      }

      return {
        checkedAt,
        databasePath: resolvedDb,
        totalIndexedFiles,
        staleFilesCount,
        missingFilesCount,
        totalSymbols,
        expiredCacheEntriesCount,
        isStale,
        recommendations,
      };
    } finally {
      db.close();
    }
  }

  /**
   * Safely purges ephemeral cache entries from the database without touching
   * any authoritative tables (memories, settings, durable jobs, etc.).
   */
  public async clearEphemeralCaches(databasePath: string): Promise<number> {
    const resolvedDb = path.resolve(databasePath);
    if (!fs.existsSync(resolvedDb)) return 0;

    const db = new Database(resolvedDb, { readonly: false, timeout: 5000 });
    try {
      const hasCache = db
        .prepare("SELECT count(*) as cnt FROM sqlite_master WHERE type = 'table' AND name = 'cache_entries'")
        .get() as any;
      if (!hasCache || hasCache.cnt === 0) return 0;

      const result = db.prepare('DELETE FROM cache_entries').run();
      const cleared = result.changes;

      this.logger?.info?.({
        component: 'IntelligenceRebuildManager',
        operation: 'clearEphemeralCaches',
        message: `Cleared ${cleared} ephemeral cache entries from '${resolvedDb}'`,
      });

      return cleared;
    } finally {
      db.close();
    }
  }

  /**
   * Cleans derived index tables (symbols, file_metadata) to prepare for a clean re-indexing.
   * NEVER alters authoritative user memories, settings, or durable job tables.
   */
  public async resetDerivedIndexes(databasePath: string): Promise<{ symbolsCleared: number; filesCleared: number }> {
    const resolvedDb = path.resolve(databasePath);
    if (!fs.existsSync(resolvedDb)) return { symbolsCleared: 0, filesCleared: 0 };

    const db = new Database(resolvedDb, { readonly: false, timeout: 5000 });
    try {
      let symbolsCleared = 0;
      let filesCleared = 0;

      db.transaction(() => {
        const hasSymbols = db
          .prepare("SELECT count(*) as cnt FROM sqlite_master WHERE type = 'table' AND name = 'symbols'")
          .get() as any;
        if (hasSymbols && hasSymbols.cnt > 0) {
          const res = db.prepare('DELETE FROM symbols').run();
          symbolsCleared = res.changes;
        }

        const hasFiles = db
          .prepare("SELECT count(*) as cnt FROM sqlite_master WHERE type = 'table' AND name = 'file_metadata'")
          .get() as any;
        if (hasFiles && hasFiles.cnt > 0) {
          const res = db.prepare('DELETE FROM file_metadata').run();
          filesCleared = res.changes;
        }
      })();

      this.logger?.info?.({
        component: 'IntelligenceRebuildManager',
        operation: 'resetDerivedIndexes',
        message: `Reset derived intelligence: purged ${symbolsCleared} symbols and ${filesCleared} file metadata records`,
      });

      return { symbolsCleared, filesCleared };
    } finally {
      db.close();
    }
  }
}
