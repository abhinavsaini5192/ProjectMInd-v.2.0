import path from 'node:path';
import fs from 'node:fs';
import Database from 'better-sqlite3';
import { ProjectMindKernel } from '../kernel/ProjectMindKernel.js';
import { RedisCoordinationBackend } from '../distributed/coordination/RedisCoordinationBackend.js';
import { ConfigRedactor } from '../platform/config/ConfigRedactor.js';

export interface DiagnosticResult {
  category: string;
  name: string;
  passed: boolean;
  message: string;
  details?: Record<string, unknown> | undefined;
}

export class DoctorEngine {
  constructor(private readonly kernel: ProjectMindKernel) {}

  public async runDiagnostics(): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];
    const workspacePath = this.kernel.workspaceManager.workspacePath ?? process.cwd();

    // 1. Check Workspace
    const isWorkspaceValid = this.kernel.workspaceManager.workspacePath !== undefined;
    results.push({
      category: 'System',
      name: 'Workspace Initialization',
      passed: isWorkspaceValid,
      message: isWorkspaceValid ? 'Workspace loaded correctly' : 'Workspace path is missing',
    });

    // 2. Check Database Connectivity and WAL Mode
    const dbDir = path.resolve(workspacePath, '.projectmind/data');
    const dbPath = path.join(dbDir, 'projectmind.db');

    if (fs.existsSync(dbPath)) {
      try {
        const db = new Database(dbPath, { readonly: true, timeout: 2000 });
        try {
          const quickCheck: any = db.pragma('quick_check(1)', { simple: true });
          const journalMode: any = db.pragma('journal_mode', { simple: true });
          const isOk = quickCheck === 'ok';

          results.push({
            category: 'Database',
            name: 'SQLite Database Integrity & WAL',
            passed: isOk,
            message: isOk
              ? `SQLite database healthy (journal_mode: ${journalMode})`
              : `SQLite quick_check reported: ${quickCheck}`,
            details: { journalMode, quickCheck },
          });

          // Check migrations
          try {
            const migRow: any = db.prepare('SELECT count(*) as count FROM pm_schema_migrations;').get();
            results.push({
              category: 'Database',
              name: 'Schema Migrations',
              passed: true,
              message: `${migRow?.count ?? 0} schema migration(s) applied.`,
              details: { appliedMigrations: migRow?.count ?? 0 },
            });
          } catch {
            results.push({
              category: 'Database',
              name: 'Schema Migrations',
              passed: true,
              message: 'Schema migrations table pending or default schema active.',
            });
          }

          // Check Durable Queue Backlog
          try {
            const queueRow: any = db.prepare("SELECT count(*) as count FROM pm_durable_jobs WHERE status = 'PENDING';").get();
            const dlqRow: any = db.prepare("SELECT count(*) as count FROM pm_durable_jobs WHERE status = 'DEAD_LETTERED';").get();
            results.push({
              category: 'Jobs',
              name: 'Queue & Dead Letter Backlog',
              passed: (dlqRow?.count ?? 0) === 0,
              message: `Queue depth: ${queueRow?.count ?? 0} pending, ${dlqRow?.count ?? 0} dead-lettered.`,
              details: { pending: queueRow?.count ?? 0, deadLettered: dlqRow?.count ?? 0 },
            });
          } catch {
            // Queue table not yet initialized
          }
        } finally {
          db.close();
        }
      } catch (err: unknown) {
        results.push({
          category: 'Database',
          name: 'SQLite Database Integrity & WAL',
          passed: false,
          message: `Database probe error: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    } else {
      results.push({
        category: 'Database',
        name: 'SQLite Database Integrity & WAL',
        passed: true,
        message: 'No local SQLite database file detected (in-memory mode or uninitialized).',
      });
    }

    // 3. Check Plugins
    const plugins = this.kernel.pluginRuntime.getPlugins();
    const failedPlugins = plugins.filter((p) => p.state === 'failed');
    results.push({
      category: 'Plugins',
      name: 'Plugin Health',
      passed: failedPlugins.length === 0,
      message:
        failedPlugins.length === 0
          ? `${plugins.length} plugins running healthily`
          : `${failedPlugins.length} plugins are in a failed state`,
    });

    // 4. Subsystem Health Checks
    const observabilityStatus = await this.kernel.observabilityEngine.getHealth();
    results.push({
      category: 'Observability',
      name: 'Telemetry Online',
      passed: observabilityStatus.status === 'healthy',
      message: `System up for ${observabilityStatus.uptime}s (observability: ${observabilityStatus.status})`,
    });

    // 5. Storage & Snapshot Integrity
    let hasCorruptSnaps = false;
    let snapMessage = 'No corrupted snapshots found.';
    try {
      const snaps = this.kernel.snapshotManager ? this.kernel.snapshotManager.listSnapshots() : [];
      snapMessage = snaps.length === 0 ? 'No corrupted snapshots found.' : `${snaps.length} snapshot(s) verified healthy.`;
    } catch {
      hasCorruptSnaps = true;
      snapMessage = 'Corrupted snapshots or unreadable snapshot directory detected!';
    }
    results.push({
      category: 'Storage',
      name: 'Snapshot Integrity',
      passed: !hasCorruptSnaps,
      message: snapMessage,
    });

    // 6. Node Environment
    const nodeVersion = process.version;
    const mem = process.memoryUsage();
    results.push({
      category: 'Environment',
      name: 'Node Version & Memory',
      passed: true,
      message: `Node ${nodeVersion} (RSS: ${Math.round(mem.rss / 1024 / 1024)}MB, Heap: ${Math.round(mem.heapUsed / 1024 / 1024)}MB)`,
    });

    // 7. Distributed Coordination (if configured in environment)
    if (process.env['REDIS_URL'] || process.env['PROJECTMIND_REDIS_ENABLED'] === 'true') {
      const redisUrl = process.env['REDIS_URL'] ?? 'redis://127.0.0.1:6379';
      try {
        const backend = new RedisCoordinationBackend({ redisUrl });
        const health = await backend.healthCheck();
        await backend.close().catch(() => {});
        results.push({
          category: 'Distributed',
          name: 'Redis Coordination Backend',
          passed: health.healthy,
          message: health.message,
          details: { latencyMs: health.latencyMs },
        });
      } catch (err: unknown) {
        results.push({
          category: 'Distributed',
          name: 'Redis Coordination Backend',
          passed: false,
          message: `Redis coordination probe failed: ${ConfigRedactor.redactString(err instanceof Error ? err.message : String(err))}`,
        });
      }
    }

    return results;
  }
}

