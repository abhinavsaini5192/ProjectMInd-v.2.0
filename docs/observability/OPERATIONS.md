# Operations & Troubleshooting Guide (Phase 8.5)

This guide describes operational management, failure isolation, machine-readable dashboards, and troubleshooting procedures for ProjectMind.

---

## 1. Machine-Readable Dashboard Model

The `DashboardMetadataProvider` compiles a consolidated, provider-neutral operational summary for monitoring tools, CLI diagnostics, or future UI dashboards:

```typescript
export interface OperationalDashboardSummary {
  readonly timestamp: string;
  readonly service: {
    readonly name: string;
    readonly version: string;
    readonly status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
    readonly uptimeSeconds: number;
    readonly environment: string;
  };
  readonly trafficAndPerformance: {
    readonly totalRequests: number;
    readonly totalErrors: number;
    readonly errorRatePercentage: number;
    readonly apiLatencyStats: {
      readonly count: number;
      readonly avgMs: number;
      readonly p50Ms: number;
      readonly p90Ms: number;
      readonly p99Ms: number;
    };
  };
  readonly infrastructureHealth: {
    readonly overallHealth: HealthStatus;
    readonly criticalDependenciesHealthy: boolean;
    readonly components: Record<string, { status: HealthStatus; durationMs: number; message?: string }>;
  };
  readonly subsystems: {
    readonly context: { generationTotal: number; cacheHitRatePercentage: number };
    readonly knowledge: { updatesTotal: number; failuresTotal: number; conflictsTotal: number; retriesTotal: number };
    readonly agent: { activeSessions: number; tasksTotal: number; taskFailuresTotal: number };
    readonly verification: { runsTotal: number };
    readonly storage: { transactionFailures: number; connectionFailures: number; migrationFailures: number };
  };
  readonly activeAlertsCount: number;
  readonly activeAlerts: readonly Alert[];
  readonly activeDiagnosticsCount: number;
}
```

---

## 2. Telemetry Failure Isolation & Circuit Breaker

To guarantee that telemetry never interrupts domain processing:

1. **Bounded Ring Buffers:**
   Loggers, metrics registries, and span buffers enforce maximum capacity limits (e.g., 500 items).
2. **Drop Policies:**
   - `DROP_OLDEST`: Drops the oldest item when a queue is full to preserve recent telemetry (default).
   - `DROP_NEWEST`: Drops incoming items when a queue is full.
3. **Telemetry Circuit Breaker:**
   External telemetry sinks execute behind `TelemetryCircuitBreaker`. If 5 consecutive failures occur, the circuit switches to `OPEN` for a 30-second cooldown period, preventing repeated network hangs or cascading failures.
4. **Safe Execution Wrapper:**
   `safeTelemetryExecution(fn, fallback)` encapsulates all non-critical telemetry hooks, ensuring unhandled exceptions are suppressed.

---

## 3. Operational Troubleshooting Runbook

### Scenario A: Health Status is `DEGRADED`
1. Fetch health report via `HealthManager.getHealth()`.
2. Inspect `warnings` array: identify the optional component reporting unhealthy (e.g. telemetry exporter or cache).
3. The application is still operational and ready for traffic (`readiness.ready === true`). Check network connectivity or restart the optional adapter.

### Scenario B: Health Status is `UNHEALTHY`
1. Fetch health report via `HealthManager.getHealth()`.
2. Inspect `failures` array: identify the critical required component (e.g. SQLite database locked or disk full).
3. Check `DiagnosticManager.getActiveDiagnostics('STORAGE')` for remediation hints.
4. If database corruption is suspected, initiate the restore procedure from Phase 8.4 backup (`BackupRestoreManager.restoreBackup(...)`).

### Scenario C: High Alert Volume
1. Query `AlertManager.getActiveAlerts()`.
2. Sort by `severity === 'CRITICAL'`.
3. Acknowledge the alert using `AlertManager.acknowledgeAlert(alertId)` to signal incident ownership.
4. Once remediated, call `AlertManager.resolveAlert(alertId)`, which automatically publishes an operational event on the EventBus.
