# Metrics Architecture & Cardinality Rules (Phase 8.5)

ProjectMind defines a provider-neutral metric subsystem via `IMetricsRegistry`. It provides counters, gauges, and histograms with automatic cardinality protection and percentile statistical tracking.

---

## 1. Metric Types

| Type | Interface | Semantics | Typical Use Cases |
|---|---|---|---|
| **Counter** | `ICounter` | Monotonically increasing 64-bit integer | Total requests, errors, cache hits/misses, updates received. |
| **Gauge** | `IGauge` | Instantaneous numerical value that fluctuates up/down | Active agent sessions, concurrent database connections, queue length. |
| **Histogram** | `IHistogram` | Distribution of sampled values (tracks count, sum, min, max, avg, p50, p90, p95, p99) | Execution durations (latencies), token budget usages, payload sizes. |

---

## 2. Core Metrics Catalog

The canonical metric constants are declared in `CORE_METRIC_NAMES`:

### API
- `api_requests_total` (Counter, labels: `method`, `endpoint`, `status`)
- `api_request_duration_ms` (Histogram, labels: `method`, `endpoint`)
- `api_errors_total` (Counter, labels: `method`, `endpoint`, `status`, `error_code`)

### Storage
- `storage_query_duration_ms` (Histogram, labels: `op`, `table`)
- `storage_transaction_failures_total` (Counter, labels: `reason`)
- `storage_connection_failures_total` (Counter)
- `storage_migration_failures_total` (Counter, labels: `version`)

### Context Orchestrator
- `context_generation_total` (Counter, labels: `outcome`, `query_type`)
- `context_generation_duration_ms` (Histogram, labels: `outcome`)
- `context_cache_hits_total` (Counter)
- `context_cache_misses_total` (Counter)
- `context_invalidations_total` (Counter, labels: `reason`)
- `context_token_budget_usage` (Histogram)

### Knowledge Subsystem
- `knowledge_updates_total` (Counter, labels: `type`, `status`)
- `knowledge_update_duration_ms` (Histogram, labels: `type`, `status`)
- `knowledge_update_failures_total` (Counter, labels: `type`)
- `knowledge_retries_total` (Counter, labels: `type`)
- `knowledge_conflicts_total` (Counter, labels: `type`)

### Agent Runtime
- `agent_active_sessions` (Gauge)
- `agent_tasks_total` (Counter, labels: `type`, `outcome`)
- `agent_task_duration_ms` (Histogram, labels: `type`, `outcome`)
- `agent_task_failures_total` (Counter, labels: `type`)
- `agent_context_refreshes_total` (Counter)

### Verification & Security
- `verification_runs_total` (Counter, labels: `rule`, `outcome`)
- `verification_duration_ms` (Histogram, labels: `rule`)
- `verification_results_total` (Counter, labels: `outcome`)
- `security_auth_failures_total` (Counter)
- `security_authz_denials_total` (Counter, labels: `action`, `resource`)
- `security_scope_violations_total` (Counter)

---

## 3. Strict Cardinality Bounding

High-cardinality label explosion is a major operational risk that causes out-of-memory crashes in monitoring systems. ProjectMind enforces strict cardinality constraints:

1. **Forbidden Label Dimensions:**
   Labels containing file paths, repository paths, user input prompts, source code snippets, raw queries, or passwords/tokens are automatically filtered out.
2. **Dimension String Truncation:**
   Label values are strictly clamped to a maximum of 64 characters.
3. **Max Permutations per Metric:**
   Each metric permits a configurable maximum number of distinct label combinations (default: 100). When this threshold is exceeded, subsequent unique label series are routed into a fixed fallback bucket:
   `{ __overflow__: 'true' }`
   This guarantees that memory consumption remains strictly O(1) regardless of workload fluctuations.

---

## 4. Usage Example

```typescript
import { defaultMetricsRegistry, CORE_METRIC_NAMES } from './observability/index.js';

// Counter
defaultMetricsRegistry.counter(CORE_METRIC_NAMES.API_REQUESTS_TOTAL)
  .increment(1, { method: 'POST', endpoint: '/api/v1/context', status: '200' });

// Histogram
defaultMetricsRegistry.histogram(CORE_METRIC_NAMES.CONTEXT_GENERATION_DURATION_MS)
  .record(125, { outcome: 'SUCCESS' });

// Gauge
defaultMetricsRegistry.gauge(CORE_METRIC_NAMES.AGENT_ACTIVE_SESSIONS)
  .set(4);
```
