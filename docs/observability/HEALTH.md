# Health & Dependency Monitoring (Phase 8.5)

ProjectMind implements a multi-tier health monitoring subsystem that separates liveness, readiness, dependency health, and degraded operating modes.

---

## 1. Health Categories

1. **LIVENESS (`/health/live`):**
   Verifies that the Node.js process is alive, the event loop is spinning, and process memory/uptime is healthy.
2. **READINESS (`/health/ready`):**
   Verifies that the application is ready to accept incoming client traffic. It evaluates critical dependencies (e.g., persistent SQLite storage). If a critical dependency fails, readiness returns `ready: false`.
3. **DEPENDENCY (`/health`):**
   Tracks third-party infrastructure (databases, caches, external adapters, vector stores).
4. **INTEGRITY:**
   Verifies that database schema migrations and data structures are structurally intact.
5. **DEGRADED MODE:**
   Indicates that an optional dependency (such as an external metrics exporter or non-critical cache) has failed, but core ProjectMind capabilities remain fully functional.

---

## 2. Dependency Criticality Table

| Component | Category | Criticality | Consequence of Failure |
|---|---|---|---|
| SQLite Primary DB | DEPENDENCY / INTEGRITY | **Required (`required: true`)** | Overall Status: `UNHEALTHY`, Readiness: `false`. Traffic rejected. |
| Memory Knowledge Store | DEPENDENCY | **Required (`required: true`)** | Overall Status: `UNHEALTHY`, Readiness: `false`. Traffic rejected. |
| External Telemetry Exporter | DEPENDENCY | **Optional (`required: false`)** | Overall Status: `DEGRADED`, Readiness: `true`. Warning recorded; traffic accepted. |
| Local In-Memory Cache | DEPENDENCY | **Optional (`required: false`)** | Overall Status: `DEGRADED`, Readiness: `true`. Cache bypassed; traffic accepted. |

---

## 3. Aggregated Health Report Model

```typescript
export interface AggregatedHealthReport {
  readonly status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  readonly liveness: {
    readonly alive: boolean;
    readonly uptimeMs: number;
  };
  readonly readiness: {
    readonly ready: boolean;
    readonly criticalDependenciesHealthy: boolean;
  };
  readonly components: Record<string, HealthResult>;
  readonly warnings: readonly string[];
  readonly failures: readonly string[];
  readonly timestamp: string;
}
```

---

## 4. Usage Example

```typescript
import { defaultHealthManager } from './observability/index.js';

// Register a required dependency check
defaultHealthManager.registerCheck({
  name: 'sqlite_store',
  category: 'DEPENDENCY',
  required: true,
  check: async () => {
    const isOk = await db.ping();
    return {
      status: isOk ? 'HEALTHY' : 'UNHEALTHY',
      message: isOk ? 'Connected' : 'Connection refused',
    };
  },
});

// Evaluate readiness for Kubernetes or systemd probes
const readiness = await defaultHealthManager.getReadiness();
if (!readiness.ready) {
  // Fail probe
}
```
