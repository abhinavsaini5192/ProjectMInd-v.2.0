import type { DIContainer } from '../../workspace/di/DIContainer.js';
import type { IEventBus } from '../../workspace/interfaces/IEventBus.js';
import { IEventBusToken } from '../../workspace/interfaces/IEventBus.js';
import { ObservabilityTokens } from './ObservabilityTokens.js';
import { ObservabilityLogger } from '../logging/ObservabilityLogger.js';
import { MetricsRegistry, defaultMetricsRegistry } from '../metrics/MetricsRegistry.js';
import { Tracer, defaultTracer } from '../tracing/Tracer.js';
import { HealthManager, defaultHealthManager } from '../health/HealthManager.js';
import { DiagnosticManager, defaultDiagnosticManager } from '../diagnostics/DiagnosticManager.js';
import { AlertManager, defaultAlertManager } from '../operations/AlertManager.js';
import { OperationalEventBus } from '../operations/OperationalEventBus.js';
import { DashboardMetadataProvider } from '../dashboard/DashboardMetadata.js';

export interface ObservabilityServices {
  readonly logger: ObservabilityLogger;
  readonly metrics: MetricsRegistry;
  readonly tracer: Tracer;
  readonly health: HealthManager;
  readonly diagnostics: DiagnosticManager;
  readonly alerts: AlertManager;
  readonly operationalEventBus?: OperationalEventBus | undefined;
  readonly dashboard: DashboardMetadataProvider;
}

export class ObservabilityDISetup {
  public static registerObservability(
    container: DIContainer,
    overrides: Partial<ObservabilityServices> = {}
  ): ObservabilityServices {
    const logger = overrides.logger ?? new ObservabilityLogger();
    const metrics = overrides.metrics ?? defaultMetricsRegistry;
    const tracer = overrides.tracer ?? defaultTracer;
    const health = overrides.health ?? defaultHealthManager;
    const diagnostics = overrides.diagnostics ?? defaultDiagnosticManager;

    let opEventBus = overrides.operationalEventBus;
    if (!opEventBus) {
      try {
        const eventBus = container.resolve<IEventBus>(IEventBusToken);
        if (eventBus) {
          opEventBus = new OperationalEventBus(eventBus);
        }
      } catch {
        // EventBus might not be registered yet
      }
    }

    const alerts = overrides.alerts ?? (opEventBus ? new AlertManager({ operationalEventBus: opEventBus }) : defaultAlertManager);
    const dashboard = overrides.dashboard ?? new DashboardMetadataProvider(health, metrics, diagnostics, alerts);

    container.registerFactory(ObservabilityTokens.Logger, () => logger, 'Singleton');
    container.registerFactory(ObservabilityTokens.MetricsRegistry, () => metrics, 'Singleton');
    container.registerFactory(ObservabilityTokens.Tracer, () => tracer, 'Singleton');
    container.registerFactory(ObservabilityTokens.HealthManager, () => health, 'Singleton');
    container.registerFactory(ObservabilityTokens.DiagnosticManager, () => diagnostics, 'Singleton');
    container.registerFactory(ObservabilityTokens.AlertManager, () => alerts, 'Singleton');
    if (opEventBus) {
      container.registerFactory(ObservabilityTokens.OperationalEventBus, () => opEventBus, 'Singleton');
    }
    container.registerFactory(ObservabilityTokens.DashboardMetadataProvider, () => dashboard, 'Singleton');

    return {
      logger,
      metrics,
      tracer,
      health,
      diagnostics,
      alerts,
      operationalEventBus: opEventBus,
      dashboard,
    };
  }
}
