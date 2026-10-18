import type { PlatformConfig } from '../config/PlatformConfig.js';
import type { ProductionLogger } from '../logging/ProductionLogger.js';
import type { PlatformHealthService } from '../health/PlatformHealthService.js';
import type { PlatformTelemetryService } from '../observability/PlatformTelemetryService.js';
import type { PlatformLifecycleManager } from '../lifecycle/PlatformLifecycleManager.js';
import type { ProductionErrorBoundary } from '../errors/ProductionErrorBoundary.js';
import type { DIContainer } from '../../workspace/di/DIContainer.js';
import type { ProjectMindKernel } from '../../kernel/ProjectMindKernel.js';
import type { IProductionAgentRuntime } from '../../agent/runtime/interfaces/IProductionAgentRuntime.js';
import type { PlatformHealthReport, LivenessReport, ReadinessReport } from '../health/PlatformHealthModels.js';
import type { MetricSnapshot } from '../observability/PlatformMetricsCollector.js';

export interface ProjectMindPlatformDependencies {
  readonly config: PlatformConfig;
  readonly logger: ProductionLogger;
  readonly container: DIContainer;
  readonly healthService: PlatformHealthService;
  readonly telemetry: PlatformTelemetryService;
  readonly lifecycle: PlatformLifecycleManager;
  readonly errorBoundary: ProductionErrorBoundary;
  readonly kernel: ProjectMindKernel;
  readonly agentRuntime: IProductionAgentRuntime;
}

export class ProjectMindPlatform {
  public readonly config: PlatformConfig;
  public readonly logger: ProductionLogger;
  public readonly container: DIContainer;
  public readonly healthService: PlatformHealthService;
  public readonly telemetry: PlatformTelemetryService;
  public readonly lifecycle: PlatformLifecycleManager;
  public readonly errorBoundary: ProductionErrorBoundary;
  public readonly kernel: ProjectMindKernel;
  public readonly agentRuntime: IProductionAgentRuntime;

  constructor(deps: ProjectMindPlatformDependencies) {
    this.config = deps.config;
    this.logger = deps.logger;
    this.container = deps.container;
    this.healthService = deps.healthService;
    this.telemetry = deps.telemetry;
    this.lifecycle = deps.lifecycle;
    this.errorBoundary = deps.errorBoundary;
    this.kernel = deps.kernel;
    this.agentRuntime = deps.agentRuntime;
  }

  public async start(): Promise<void> {
    this.lifecycle.setState('STARTING');
    await this.agentRuntime.start();
    this.lifecycle.setState('READY');
    this.logger.info({
      component: 'ProjectMindPlatform',
      operation: 'start',
      message: `ProjectMind Platform '${this.config.app.name}' v${this.config.app.version} is READY in ${this.config.app.env} mode.`,
    });
  }

  public async shutdown(reason?: string): Promise<void> {
    await this.lifecycle.shutdown(reason);
  }

  public getHealth(): Promise<PlatformHealthReport> {
    return this.healthService.getHealth();
  }

  public getLiveness(): LivenessReport {
    return this.healthService.getLiveness();
  }

  public getReadiness(): Promise<ReadinessReport> {
    return this.healthService.getReadiness();
  }

  public getMetrics(): MetricSnapshot {
    return this.telemetry.getMetricsSnapshot();
  }

  public getAgentRuntime(): IProductionAgentRuntime {
    return this.agentRuntime;
  }

  public getKernel(): ProjectMindKernel {
    return this.kernel;
  }
}
