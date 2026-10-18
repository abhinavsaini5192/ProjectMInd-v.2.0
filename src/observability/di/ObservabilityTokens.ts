export const ObservabilityTokens = {
  Logger: Symbol('ILogger'),
  MetricsRegistry: Symbol('IMetricsRegistry'),
  Tracer: Symbol('ITracer'),
  HealthManager: Symbol('IHealthManager'),
  DiagnosticManager: Symbol('IDiagnosticManager'),
  AlertManager: Symbol('IAlertManager'),
  OperationalEventBus: Symbol('OperationalEventBus'),
  DashboardMetadataProvider: Symbol('DashboardMetadataProvider'),
} as const;
