import path from 'node:path';
import fs from 'node:fs';
import Database from 'better-sqlite3';
import { PlatformConfigLoader } from '../config/PlatformConfigLoader.js';
import type { PlatformConfig, PlatformConfigOverrides } from '../config/PlatformConfig.js';

import { ProductionLogger } from '../logging/ProductionLogger.js';
import { ProductionErrorBoundary } from '../errors/ProductionErrorBoundary.js';
import { PlatformError } from '../errors/PlatformError.js';
import { DIContainer } from '../../workspace/di/DIContainer.js';
import { NodeEventBus } from '../../workspace/events/NodeEventBus.js';
import { ProjectMindKernel } from '../../kernel/ProjectMindKernel.js';
import { PlatformHealthService } from '../health/PlatformHealthService.js';
import { PlatformTelemetryService } from '../observability/PlatformTelemetryService.js';
import { PlatformMetricsCollector } from '../observability/PlatformMetricsCollector.js';
import { PlatformLifecycleManager } from '../lifecycle/PlatformLifecycleManager.js';
import { ProcessSignalHandler } from '../lifecycle/ProcessSignalHandler.js';
import { ProjectMindPlatform } from '../core/ProjectMindPlatform.js';
import { PlatformTokens } from '../di/PlatformTokens.js';

// Agent Runtime imports
import { AgentSessionManager } from '../../agent/runtime/AgentSessionManager.js';
import { createTaskRuntime } from '../../agent/runtime/di/TaskRuntimeDISetup.js';
import { createAgentContextSessionManager } from '../../agent/context/di/AgentContextDISetup.js';
import { AgentToolRegistry } from '../../agent/protocol/registry/AgentToolRegistry.js';
import { AgentToolPipeline } from '../../agent/protocol/pipeline/AgentToolPipeline.js';
import { createProductionAgentRuntime } from '../../agent/runtime/di/AgentRuntimeDISetup.js';
import type { IContextOrchestrator } from '../../context/interfaces/IContextOrchestrator.js';
import { SecurityDISetup } from '../../security/di/SecurityDISetup.js';
import { RedisCoordinationBackend } from '../../distributed/coordination/RedisCoordinationBackend.js';
import { ConfigRedactor } from '../config/ConfigRedactor.js';

export interface BootstrapOptions {
  readonly workspacePath?: string | undefined;
  readonly configOverrides?: PlatformConfigOverrides | undefined;
  readonly disableSignalHandlers?: boolean | undefined;
}

export class ProductionBootstrap {
  public static async bootstrap(options: BootstrapOptions = {}): Promise<ProjectMindPlatform> {
    const startTime = Date.now();
    let config: PlatformConfig;
    let logger: ProductionLogger | undefined;

    try {
      // 1. Load & Validate Configuration
      config = PlatformConfigLoader.load(options.configOverrides);

      // 2. Initialize Structured Logger
      logger = new ProductionLogger({
        minLevel: config.app.logLevel,
        env: config.app.env,
        format: config.observability.logFormat,
        redactionEnabled: config.observability.secretRedactionEnabled,
      });

      logger.info({
        component: 'ProductionBootstrap',
        operation: 'bootstrap',
        message: `Starting ProjectMind Platform '${config.app.name}' v${config.app.version} in ${config.app.env} mode...`,
      });

      // 3. Initialize Error Boundary
      const errorBoundary = new ProductionErrorBoundary(config.app.env);

      // 4. Initialize DI Container & EventBus
      const container = new DIContainer();
      const eventBus = new NodeEventBus();

      // 5. Initialize Kernel & Workspace
      const workspacePath = options.workspacePath ?? process.cwd();
      const kernel = new ProjectMindKernel(workspacePath, {
        debug: config.app.logLevel === 'DEBUG',
      });
      await kernel.initialize();

      // 6. Initialize Agent Runtime Subsystems
      const sessionManager = new AgentSessionManager(eventBus);

      // Connect context orchestrator conforming to IContextOrchestrator
      const buildDummyPackage = () => ({
        packageId: `ctx_pkg_${Date.now()}`,
        generatedAt: Date.now(),
        task: { text: 'Default Task' },
        features: [],
        resources: [],
        behavior: [],
        dependencies: [],
        tests: [],
        history: [],
        warnings: [],
        selectionReasons: {},
        completeness: 'COMPLETE' as const,
        freshness: 'FRESH' as const,
        estimatedTokens: 150,
        version: 1,
      });

      const contextOrchestrator: IContextOrchestrator = (kernel as any).contextOrchestrator ?? {
        orchestrateContext: async (_req: any) => ({
          package: buildDummyPackage(),
          plan: { planId: 'plan_1', steps: [] } as any,
          explanation: { reasons: [] } as any,
          metrics: { latencyMs: 5 } as any,
        }),
        getContextPlan: async () => ({ planId: 'plan_1', steps: [] } as any),
        getContextPackage: async () => buildDummyPackage() as any,
        getFeatureContextForTask: async () => ({
          package: buildDummyPackage(),
          plan: { planId: 'plan_1', steps: [] } as any,
          explanation: { reasons: [] } as any,
          metrics: { latencyMs: 5 } as any,
        }),
        getContextExplanation: async () => ({ reasons: [] } as any),
        estimateContextTokens: async () => 150,
        validateContextRequest: () => {},
      };

      const contextSessionManager = createAgentContextSessionManager({
        contextOrchestrator,
        sessionManager,
        eventBus,
      });

      // Create Task Runtime
      const taskRuntime = createTaskRuntime({
        eventBus,
        contextSessionManager,
        agentSessionManager: sessionManager,
      });

      // Create Tool Pipeline
      const toolRegistry = new AgentToolRegistry();
      const toolPipeline = new AgentToolPipeline({
        registry: toolRegistry,
        sessionManager,
      });

      // Create Production Agent Runtime
      const agentRuntime = createProductionAgentRuntime({
        sessionManager,
        taskRuntime,
        contextSessionManager,
        toolPipeline,
        executionCoordinator: (taskRuntime as any).deps?.executionCoordinator ?? (taskRuntime as any).executionCoordinator,
        verificationCoordinator: (taskRuntime as any).deps?.verificationCoordinator ?? (taskRuntime as any).verificationCoordinator,
        eventBus,
        config: {
          runtimeId: `runtime_${config.app.name}`,
          workspaceId: workspacePath,
          repositoryId: 'default-repo',
          limits: {
            maxConcurrentSessions: config.runtime.maxConcurrentSessions,
            maxConcurrentTasks: config.runtime.maxConcurrentTasks,
            sessionTimeoutMs: config.runtime.sessionTimeoutMs,
            taskTimeoutMs: config.runtime.taskTimeoutMs,
            toolTimeoutMs: config.runtime.toolTimeoutMs,
            contextTimeoutMs: config.runtime.contextTimeoutMs,
            recoveryTimeoutMs: config.runtime.recoveryTimeoutMs,
            shutdownTimeoutMs: config.runtime.shutdownTimeoutMs,
            maxRequestSizeBytes: config.storage.maxPayloadSizeBytes,
            maxResponseSizeBytes: config.storage.maxPayloadSizeBytes,
          },
          contextRefreshPolicy: config.runtime.contextRefreshPolicy,
        },
      });

      await agentRuntime.initialize();

      // 7. Initialize Observability & Metrics
      const metricsCollector = new PlatformMetricsCollector();
      const telemetry = new PlatformTelemetryService(metricsCollector);

      // 8. Initialize Health Service & Register Components
      const healthService = new PlatformHealthService(config.app.version, config.app.env);

      healthService.registerComponent(
        'CONFIG',
        async () => ({ status: 'HEALTHY', message: 'Platform configuration is valid.' }),
        true
      );

      healthService.registerComponent(
        'KERNEL',
        async () => ({ status: 'HEALTHY', message: 'ProjectMind Kernel is initialized.' }),
        true
      );

      healthService.registerComponent(
        'EVENT_BUS',
        async () => ({ status: 'HEALTHY', message: 'Event bus is operational.' }),
        true
      );

      healthService.registerComponent(
        'AGENT_RUNTIME',
        async () => {
          const rHealth = await agentRuntime.getHealth();
          return {
            status: rHealth.status === 'UNHEALTHY' ? 'UNHEALTHY' : (rHealth.status === 'DEGRADED' ? 'DEGRADED' : 'HEALTHY'),
            details: rHealth.subsystems,
          };
        },
        true
      );

      // Real non-destructive dependency check for Storage / SQLite
      healthService.registerComponent(
        'STORAGE_SQLITE',
        async () => {
          if (config.storage.type === 'memory') {
            return {
              status: 'HEALTHY',
              message: 'In-memory storage operational',
              details: { type: 'memory' },
            };
          }

          const dbPath = config.database.url
            ? config.database.url.replace(/^sqlite:\/\//, '')
            : path.resolve(workspacePath, config.storage.location, 'projectmind.db');

          if (!fs.existsSync(dbPath)) {
            return {
              status: 'HEALTHY',
              message: `SQLite database file pending initialization at ${path.basename(dbPath)}`,
              details: { location: path.basename(dbPath) },
            };
          }

          try {
            const probeDb = new Database(dbPath, { readonly: true, timeout: 2000 });
            try {
              const row: any = probeDb.prepare('SELECT 1 as alive;').get();
              const pragmaRow: any = probeDb.pragma('journal_mode', { simple: true });
              return {
                status: row?.alive === 1 ? 'HEALTHY' : 'UNHEALTHY',
                message: `SQLite database responsive (journal_mode: ${pragmaRow})`,
                details: { journalMode: pragmaRow, location: path.basename(dbPath) },
              };
            } finally {
              probeDb.close();
            }
          } catch (err: unknown) {
            return {
              status: 'UNHEALTHY',
              message: `SQLite database connectivity probe failed: ${err instanceof Error ? err.message : String(err)}`,
            };
          }
        },
        true
      );

      // Real check for Durable Jobs queue if role is worker or all
      if (config.role === 'worker' || config.role === 'all') {
        healthService.registerComponent(
          'DURABLE_JOBS',
          async () => {
            const dbPath = config.database.url
              ? config.database.url.replace(/^sqlite:\/\//, '')
              : path.resolve(workspacePath, config.storage.location, 'projectmind.db');

            if (!fs.existsSync(dbPath)) {
              return { status: 'HEALTHY', message: 'Durable jobs schema pending initialization.' };
            }

            try {
              const probeDb = new Database(dbPath, { readonly: true, timeout: 2000 });
              try {
                const row: any = probeDb.prepare("SELECT count(*) as count FROM pm_durable_jobs WHERE status = 'PENDING';").get();
                return {
                  status: 'HEALTHY',
                  message: `Job queue responsive (${row?.count ?? 0} pending jobs)`,
                  details: { pendingJobs: row?.count ?? 0 },
                };
              } finally {
                probeDb.close();
              }
            } catch (err: unknown) {
              return {
                status: 'DEGRADED',
                message: `Job queue probe notice: ${err instanceof Error ? err.message : String(err)}`,
              };
            }
          },
          false
        );
      }

      // Real check for Redis if configured
      let redisBackendProbe: RedisCoordinationBackend | null = null;
      if (config.redis.enabled) {
        healthService.registerComponent(
          'REDIS',
          async () => {
            if (!config.redis.url) {
              return { status: 'DEGRADED', message: 'Redis is enabled but no URL configured; operating in local mode.' };
            }
            try {
              if (!redisBackendProbe) {
                redisBackendProbe = new RedisCoordinationBackend({
                  redisUrl: config.redis.url,
                  connectTimeoutMs: config.redis.connectTimeoutMs,
                  logger,
                });
              }
              const health = await redisBackendProbe.healthCheck();
              return {
                status: health.healthy ? 'HEALTHY' : 'UNHEALTHY',
                message: health.message,
                details: {
                  url: ConfigRedactor.redactString(config.redis.url),
                  latencyMs: health.latencyMs,
                  state: redisBackendProbe.getConnectionState(),
                },
              };
            } catch (err: unknown) {
              return {
                status: 'UNHEALTHY',
                message: `Redis connectivity probe failed: ${ConfigRedactor.redactString(err instanceof Error ? err.message : String(err))}`,
              };
            }
          },
          false
        );
      }


      // 9. Initialize Lifecycle Manager with shutdown hooks
      const lifecycle = new PlatformLifecycleManager(
        config.runtime.shutdownTimeoutMs,
        {
          onStopInboundRequests: async () => {
            await agentRuntime.pause('Platform shutdown');
          },
          onCreateCheckpoint: async () => {
            try {
              await agentRuntime.createCheckpoint('shutdown_checkpoint');
            } catch {
              // Non-blocking during shutdown
            }
          },
          onCloseStorage: async () => {
            if (redisBackendProbe) {
              await redisBackendProbe.close().catch(() => {});
            }
            await kernel.shutdown();
          },
        },
        logger
      );

      // 10. Register Services in DI Container
      SecurityDISetup.register(container, eventBus);
      container.registerFactory(PlatformTokens.IPlatformConfig, () => config, 'Singleton');
      container.registerFactory(PlatformTokens.IProductionLogger, () => logger, 'Singleton');
      container.registerFactory(PlatformTokens.IPlatformHealthService, () => healthService, 'Singleton');
      container.registerFactory(PlatformTokens.IPlatformTelemetry, () => telemetry, 'Singleton');
      container.registerFactory(PlatformTokens.IPlatformLifecycleManager, () => lifecycle, 'Singleton');

      const platform = new ProjectMindPlatform({
        config,
        logger,
        container,
        healthService,
        telemetry,
        lifecycle,
        errorBoundary,
        kernel,
        agentRuntime,
      });

      container.registerFactory(PlatformTokens.IProjectMindPlatform, () => platform, 'Singleton');

      // 11. Attach Signal Handlers (unless disabled for tests)
      if (!options.disableSignalHandlers) {
        const signalHandler = new ProcessSignalHandler(async (signal) => {
          logger?.info({
            component: 'ProcessSignalHandler',
            operation: 'handleSignal',
            message: `Received ${signal}. Shutting down ProjectMind Platform...`,
          });
          await platform.shutdown(`Signal: ${signal}`);
        });
        signalHandler.attach();
      }

      // Record startup telemetry
      const durationMs = Date.now() - startTime;
      telemetry.recordStartup(durationMs, true);

      logger.info({
        component: 'ProductionBootstrap',
        operation: 'bootstrap',
        message: `ProjectMind Platform bootstrap completed in ${durationMs}ms.`,
        durationMs,
      });

      return platform;
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;
      const errorMsg = err instanceof Error ? err.message : String(err);

      if (logger) {
        logger.error({
          component: 'ProductionBootstrap',
          operation: 'bootstrap_failed',
          message: `Fatal error during ProjectMind Platform bootstrap: ${errorMsg}`,
          durationMs,
        });
      } else {
        console.error(`[FATAL] ProjectMind Platform bootstrap failed: ${errorMsg}`);
      }

      throw new PlatformError(`Bootstrap failed: ${errorMsg}`, {
        code: 'INITIALIZATION_ERROR',
        statusCode: 500,
        cause: err,
        suggestedRecovery: 'Verify configuration parameters and dependency accessibility.',
      });
    }
  }
}
