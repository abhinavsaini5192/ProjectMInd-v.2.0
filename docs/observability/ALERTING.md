# Provider-Neutral Alerting Abstraction (Phase 8.5)

ProjectMind provides a provider-neutral alerting system through `IAlertManager`. It manages alert conditions, policy evaluations, deduplication, and cooldowns without depending on external notification vendors.

---

## 1. Alert Data Model & Lifecycle

```typescript
export type AlertSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
export type AlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'SUPPRESSED';

export interface Alert {
  readonly alertId: string;
  readonly severity: AlertSeverity;
  readonly category: AlertCategory;
  readonly source: string;
  readonly condition: string;
  readonly timestamp: string;
  readonly status: AlertStatus;
  readonly correlationId?: string;
  readonly message: string;
  readonly metadata?: Record<string, unknown>;
  readonly resolvedAt?: string;
  readonly acknowledgedAt?: string;
}
```

### Lifecycle State Machine:
```
  [OPEN] ──(acknowledge)──> [ACKNOWLEDGED]
    │                             │
    ├──(resolve)──────────────────┴──> [RESOLVED]
    │
    └──(suppress)────────────────────> [SUPPRESSED]
```

---

## 2. Policy-Based Alert Evaluation

Alert policies decouple alert triggering rules from business code:

```typescript
export interface AlertPolicy {
  readonly policyId: string;
  readonly name: string;
  readonly category: AlertCategory;
  readonly severity: AlertSeverity;
  readonly conditionDescription: string;
  readonly cooldownMs?: number;
  evaluate(context: AlertEvaluationContext): boolean;
}
```

### Protection Against Alert Storms:
- **Deduplication:** When an alert is created, the manager verifies whether an identical alert (`source`, `category`, and `condition`) is currently in `OPEN` or `ACKNOWLEDGED` status. If so, the existing alert is returned, preventing redundant alerts.
- **Cooldown Window:** Each policy specifies a `cooldownMs` window (default: 60,000 ms). Successive triggers within this window are throttled.

---

## 3. Usage Example

```typescript
import { defaultAlertManager } from './observability/index.js';

// Define a policy for repeated storage errors
defaultAlertManager.registerPolicy({
  policyId: 'policy-storage-errors',
  name: 'Repeated Storage Failures',
  category: 'STORAGE',
  severity: 'CRITICAL',
  conditionDescription: 'failureCount > 3',
  cooldownMs: 30000,
  evaluate: (ctx) => (ctx.errorCount ?? 0) > 3,
});

// Evaluate policy from error handler
defaultAlertManager.evaluatePolicies({
  category: 'STORAGE',
## 4. Production Prometheus Alert Rules & Operational Runbooks (Phase 10.6)

In addition to programmatic policy evaluation, ProjectMind includes deployment-ready Prometheus alert rules in `deploy/observability/prometheus-alerts.yaml`. These alerts target real signals emitted by ProjectMind's metrics registry:

| Alert Name | Severity | Signal / Expression | Likely Causes | Recommended First Action |
| :--- | :--- | :--- | :--- | :--- |
| **ProjectMindHighErrorRate** | `critical` | HTTP 5xx error rate > 5% over 5m | Database locks, unhandled exceptions, downstream outage | Check structured logs for `errorClassification` and active correlation IDs. |
| **ProjectMindHighRequestLatency** | `warning` | p99 API latency > 2s over 5m | Heavy graph queries, SQLite WAL contention, memory pressure | Inspect slow query logs, review `/v1/metrics`, verify WAL checkpointing. |
| **ProjectMindDatabaseDown** | `critical` | Storage health probe returns 0 (unhealthy) | SQLite file locked, corrupt DB, disk out of space | Run `projectmind doctor` to verify WAL journal mode and disk I/O. |
| **ProjectMindJobQueueBacklogGrowing** | `warning` | Job queue depth > 500 for 10m | Worker starvation, long-running blocking tasks | Scale worker replicas, check worker logs for timeout errors. |
| **ProjectMindDeadLetterAccumulation** | `critical` | Dead letter jobs > 0 for 5m | Poison pill payloads, invalid schema, fatal execution | Inspect dead letter jobs in `pm_durable_jobs`, review root causes. |
| **ProjectMindOutboxDispatchStalled** | `warning` | Outbox failed events increasing over 5m | Broker connection down, network partition | Verify event bus / broker status, check Redis/RabbitMQ logs. |
| **ProjectMindWorkerStarvation** | `warning` | Active workers == 0 while queue depth > 0 | Worker crash loop, misconfigured deployment | Verify worker container liveness, restart failed worker instances. |
| **ProjectMindHighRestartRate** | `critical` | Process uptime reset > 3 times in 15m | Fatal OOM kill, unhandled native crashes | Check container exit codes (SIGKILL/SIGSEGV), inspect node memory. |
| **ProjectMindHighMemoryUsage** | `warning` | Process RSS memory > 1.5GB for 10m | Memory leak, unbounded caches, large in-flight payloads | Inspect `/metrics` heap usage, review cache eviction policies. |

---

## 5. Alert Response Workflow

```
[Prometheus / Alertmanager] 
       │
       ▼
 [PagerDuty / Slack] ──> On-Call Engineer
                              │
                              ├── 1. Run: projectmind health
                              ├── 2. Run: projectmind doctor
                              ├── 3. Query logs: filter by correlationId or errorClassification
                              └── 4. Mitigate: drain traffic, restart or scale workers
```
