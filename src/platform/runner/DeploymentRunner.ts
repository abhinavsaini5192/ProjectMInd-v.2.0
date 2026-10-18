import path from 'node:path';
import fs from 'node:fs';
import Database from 'better-sqlite3';
import { ProductionBootstrap } from '../bootstrap/ProductionBootstrap.js';
import { PlatformConfigLoader } from '../config/PlatformConfigLoader.js';
import type { PlatformConfig, PlatformConfigOverrides, DeploymentRole } from '../config/PlatformConfig.js';
import { PlatformServer } from '../server/PlatformServer.js';
import { StorageMigrationRunner, type MigrationExecutionResult } from '../../storage/migration/StorageMigrationRunner.js';
import { ProcessSignalHandler } from '../lifecycle/ProcessSignalHandler.js';
import { DurableJobQueue } from '../../jobs/queue/DurableJobQueue.js';
import { SqliteJobRepository } from '../../jobs/persistence/SqliteJobRepository.js';
import { WorkerPool } from '../../jobs/workers/WorkerPool.js';
import { JobRegistry } from '../../jobs/registry/JobRegistry.js';
import { JobLeaseManager } from '../../jobs/recovery/JobLeaseManager.js';
import { SqliteDeadLetterQueue } from '../../jobs/recovery/SqliteDeadLetterQueue.js';
import { SqliteTransactionalOutbox } from '../../jobs/events/outbox/SqliteTransactionalOutbox.js';
import { OutboxDispatcher } from '../../jobs/events/outbox/OutboxDispatcher.js';
import { JobRetentionService } from '../../jobs/retention/JobRetentionService.js';
import { NodeEventBus } from '../../workspace/events/NodeEventBus.js';
import type { ProjectMindPlatform } from '../core/ProjectMindPlatform.js';

export interface DeploymentRunnerOptions {
  readonly role?: DeploymentRole | undefined;
  readonly configOverrides?: PlatformConfigOverrides | undefined;
  readonly disableSignalHandlers?: boolean | undefined;
  readonly workspacePath?: string | undefined;
}

export interface DeploymentRunResult {
  readonly role: DeploymentRole;
  readonly platform?: ProjectMindPlatform | undefined;
  readonly server?: PlatformServer | undefined;
  readonly migrationResult?: MigrationExecutionResult | undefined;
  readonly stop: () => Promise<void>;
}

/**
 * DeploymentRunner starts and manages ProjectMind platform runtime roles:
 * - 'migration': executes schema migrations and exits
 * - 'api': serves HTTP API routes, health, readiness, and metrics
 * - 'worker': executes background durable jobs and transactional outbox dispatching
 * - 'scheduler': executes periodic retention and maintenance tasks
 * - 'all': full unified runtime (default for development and single-container deployments)
 */
export class DeploymentRunner {
  public static async run(options: DeploymentRunnerOptions = {}): Promise<DeploymentRunResult> {
    const config = PlatformConfigLoader.load(options.configOverrides);
    const effectiveRole: DeploymentRole = options.role ?? config.role ?? 'all';

    const workspacePath = options.workspacePath ?? process.cwd();
    const dataDir = path.resolve(workspacePath, config.storage.location);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const dbPath = config.database.url
      ? config.database.url.replace(/^sqlite:\/\//, '')
      : path.join(dataDir, 'projectmind.db');

    // 1. Role: Migration
    if (effectiveRole === 'migration') {
      const migrationRunner = new StorageMigrationRunner({
        databasePath: dbPath,
        environment: config.app.env,
      });

      const migrationResult = await migrationRunner.runMigrations();
      return {
        role: 'migration',
        migrationResult,
        stop: async () => {},
      };
    }

    // Auto-migrate if enabled and database path exists
    if (config.database.autoMigrate) {
      try {
        const migrationRunner = new StorageMigrationRunner({
          databasePath: dbPath,
          environment: config.app.env,
        });
        await migrationRunner.runMigrations();
      } catch (err: unknown) {
        console.warn(`[DeploymentRunner] Auto-migration notice: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // 2. Bootstrap Core Platform
    const platform = await ProductionBootstrap.bootstrap({
      workspacePath,
      configOverrides: { ...options.configOverrides, role: effectiveRole },
      disableSignalHandlers: options.disableSignalHandlers,
    });

    await platform.start();

    let server: PlatformServer | undefined;
    let workerPool: WorkerPool | undefined;
    let outboxDispatcher: OutboxDispatcher | undefined;
    let schedulerTimer: NodeJS.Timeout | undefined;
    let dbInstance: Database.Database | undefined;

    // Helper to initialize worker/outbox infrastructure
    const initWorkerInfrastructure = () => {
      dbInstance = new Database(dbPath);
      dbInstance.pragma('journal_mode = WAL');
      dbInstance.pragma('synchronous = NORMAL');
      dbInstance.pragma('busy_timeout = 5000');

      const jobRepo = new SqliteJobRepository(dbInstance);
      const jobQueue = new DurableJobQueue(dbInstance);
      const registry = new JobRegistry();
      const leaseManager = new JobLeaseManager();
      const dlq = new SqliteDeadLetterQueue(dbInstance);
      const eventBus = new NodeEventBus();

      workerPool = new WorkerPool(jobQueue, jobRepo, registry, leaseManager, dlq, {
        concurrency: config.worker.concurrency,
        workerOptions: {
          pollIntervalMs: config.worker.pollIntervalMs,
          leaseTtlMs: config.worker.visibilityTimeoutMs,
        },
      });

      const outbox = new SqliteTransactionalOutbox(dbInstance);
      outboxDispatcher = new OutboxDispatcher(outbox, eventBus, {
        pollIntervalMs: config.worker.pollIntervalMs,
      });

      workerPool.start();
      outboxDispatcher.start();

      platform.logger.info({
        component: 'DeploymentRunner',
        operation: 'start_worker',
        message: `Durable worker pool started with concurrency ${config.worker.concurrency} and visibility timeout ${config.worker.visibilityTimeoutMs}ms.`,
      });
    };

    // Helper to initialize scheduler maintenance loop
    const initScheduler = () => {
      if (!dbInstance) {
        dbInstance = new Database(dbPath);
        dbInstance.pragma('journal_mode = WAL');
        dbInstance.pragma('synchronous = NORMAL');
        dbInstance.pragma('busy_timeout = 5000');
      }

      const retentionService = new JobRetentionService(dbInstance, {
        completedJobsRetentionDays: 1,
        dispatchedOutboxRetentionDays: 1,
        processedInboxRetentionDays: 1,
      });

      // Run cleanup every 60 seconds
      schedulerTimer = setInterval(() => {
        retentionService.purgeExpiredRecords().catch(() => {
          // Non-blocking background cleanup
        });
      }, 60000);

      platform.logger.info({
        component: 'DeploymentRunner',
        operation: 'start_scheduler',
        message: 'Periodic maintenance and retention scheduler active.',
      });
    };

    // 3. Role Execution
    if (effectiveRole === 'api' || effectiveRole === 'all') {
      server = new PlatformServer(platform, {
        port: config.server.port,
        host: config.server.host,
        drainTimeoutMs: config.server.drainTimeoutMs,
      });
      await server.start();
    }

    if (effectiveRole === 'worker' || effectiveRole === 'all') {
      initWorkerInfrastructure();

      // If pure worker role, start lightweight server on port for k8s probes
      if (effectiveRole === 'worker') {
        server = new PlatformServer(platform, {
          port: config.server.port,
          host: config.server.host,
          drainTimeoutMs: config.server.drainTimeoutMs,
        });
        await server.start();
      }
    }

    if (effectiveRole === 'scheduler' || effectiveRole === 'all') {
      initScheduler();

      // If pure scheduler role, start lightweight server on port for k8s probes
      if (effectiveRole === 'scheduler' && !server) {
        server = new PlatformServer(platform, {
          port: config.server.port,
          host: config.server.host,
          drainTimeoutMs: config.server.drainTimeoutMs,
        });
        await server.start();
      }
    }

    // Coordinated Graceful Stop Handler
    const stop = async (): Promise<void> => {
      platform.logger.info({
        component: 'DeploymentRunner',
        operation: 'stop',
        message: `Initiating coordinated shutdown for role '${effectiveRole}'...`,
      });

      if (schedulerTimer) {
        clearInterval(schedulerTimer);
        schedulerTimer = undefined;
      }

      if (workerPool) {
        await workerPool.stop(5000);
        workerPool = undefined;
      }

      if (outboxDispatcher) {
        await outboxDispatcher.stop();
        outboxDispatcher = undefined;
      }

      if (server) {
        await server.stop();
        server = undefined;
      }

      if (dbInstance) {
        try {
          dbInstance.close();
        } catch {
          // Ignored
        }
        dbInstance = undefined;
      }

      await platform.shutdown(`Deployment role '${effectiveRole}' stopped`);
    };

    // Attach signal handling unless disabled
    if (!options.disableSignalHandlers) {
      const signalHandler = new ProcessSignalHandler(async (signal) => {
        platform.logger.info({
          component: 'DeploymentRunner',
          operation: 'signal_shutdown',
          message: `Received ${signal}. Shutting down ProjectMind role '${effectiveRole}'...`,
        });
        await stop();
      });
      signalHandler.attach();
    }

    return {
      role: effectiveRole,
      platform,
      server,
      stop,
    };
  }
}
