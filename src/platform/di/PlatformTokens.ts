export const PlatformTokens = {
  IPlatformConfig: Symbol.for('IPlatformConfig'),
  IProductionLogger: Symbol.for('IProductionLogger'),
  IPlatformHealthService: Symbol.for('IPlatformHealthService'),
  IPlatformTelemetry: Symbol.for('IPlatformTelemetry'),
  IPlatformLifecycleManager: Symbol.for('IPlatformLifecycleManager'),
  IProjectMindPlatform: Symbol.for('IProjectMindPlatform'),
} as const;
