# Phase 9.9 — Enterprise Intelligence & Analytics Architecture

## 1. Executive Overview

ProjectMind Phase 9.9 establishes an enterprise-grade operational intelligence and analytics subsystem that transforms real-time domain events, audited actions, and operational telemetry into trustworthy, queryable, explainable, and multi-tenant metrics and reports.

```
       Existing ProjectMind Systems (Phases 1–9.8)
(Context, Planner, Runtime, Verifier, Plugins, Learning, Audit)
                             │
                             ▼
             Authoritative Domain Events & Audit Logs
                             │
                             ▼
         Analytics Collection Pipeline & Bridges
      (EventBusAnalyticsBridge, AuditAnalyticsBridge)
                             │
                             ▼
            Scope & Privacy Validation Engine
              (Multi-tenant isolation & RBAC)
                             │
                             ▼
              Canonical Metric Aggregator
      (SUM, AVG, COUNT, LATEST, P50, P90, P99, RATIO)
                             │
                             ▼
          Deterministic Grounded Insight Engine
          (Rule-based evaluation & evidence refs)
                             │
                             ▼
               Reporting & Snapshot Engine
               (10 Standard Enterprise Reports)
                             │
                             ▼
          Public REST API & CLI Command Interfaces
```

---

## 2. Key Architectural Tenets

### 2.1 Observability vs. Analytics
- **Operational Observability (`src/observability/`)**: Real-time diagnostics, tracing spans, counter increments, health liveness/readiness probes, and system alert routing.
- **Enterprise Analytics (`src/analytics/`)**: Historical, scope-aware aggregation answering business, project, adoption, quality, and governance questions across workspaces and time horizons.
- **Audit Records (`src/storage/repositories/PersistentAuditStore.ts`)**: Immutable ledger of security-critical actions and compliance events.
- **Analytics Reports**: Reproducible statistical summaries grounded in audited evidence without modifying underlying source records.

### 2.2 No Fabricated Metrics & Strict Null Semantics
Analytics strictly reports what available empirical evidence proves:
- **Zero (`0`)**: Explicitly means zero occurrences occurred within the window for a measured counter/sum metric whose source is active.
- **Unavailable (`null`, status: `'UNAVAILABLE'`)**: Explicitly indicates that no measurements were recorded for an average, percentage, ratio, or latency metric. A latency is **never** fabricated as `0ms` when 0 requests were executed.
- **Not Applicable (`null`, status: `'NOT_APPLICABLE'`)**: Represents indeterminate ratios (e.g. 0 denominator).

---

## 3. Canonical Domain Models

| Model | Path | Responsibility |
|---|---|---|
| `AnalyticsMetric` | `src/analytics/models/AnalyticsMetric.ts` | Named, versioned metric definition with unit, category, source, freshness SLA, and privacy level |
| `AnalyticsRecord` | `src/analytics/models/AnalyticsRecord.ts` | Normalized, attributable observation ingested with actor, correlation ID, and timestamp |
| `AnalyticsSnapshot` | `src/analytics/models/AnalyticsSnapshot.ts` | Immutable aggregate for an explicit scope and time window with evaluated data quality |
| `AnalyticsReport` | `src/analytics/models/AnalyticsReport.ts` | Reproducible report containing metric definitions, results, data quality, and deterministic insights |
| `AnalyticsInsight` | `src/analytics/models/AnalyticsInsight.ts` | Grounded insight linking observed metric value directly to baselines, thresholds, and evidence |
| `AnalyticsDataQuality` | `src/analytics/models/AnalyticsDataQuality.ts` | Evaluates coverage ratio, missing metric sources, and stale telemetry |

---

## 4. Multi-Tenancy and Scope Boundaries

The subsystem supports hierarchical scopes defined in `AnalyticsScopeRef`:
- `INSTANCE`: Global platform metrics (requires administrative role: `OWNER` or `ADMIN`).
- `WORKSPACE`: Bounded to an explicit workspace. Non-admin callers can only access workspaces they belong to.
- `PROJECT`: Bounded to a specific project within a workspace.
- `REPOSITORY`: Bounded to a repository index.
- `PLUGIN`: Bounded to an individual plugin entity.

Cross-workspace data access attempts are strictly rejected with `AnalyticsScopeUnauthorizedError`.

---

## 5. Analytics Categories

Phase 9.9 implements metrics across 10 canonical categories:
1. **Platform Usage (`PLATFORM_USAGE`)**: Active workspaces, projects, context requests, tasks completed, sessions.
2. **Repository Intelligence (`REPOSITORY_INTELLIGENCE`)**: Repositories analyzed, extraction success/failure, indexed resources, feature counts.
3. **Context Intelligence (`CONTEXT_INTELLIGENCE`)**: Request volume, package token sizes, assembly latencies, cache hit rates.
4. **Retrieval & Memory (`RETRIEVAL_AND_MEMORY`)**: Search query volume, latency, project memory recalls, failure rates.
5. **Agent Collaboration (`AGENT_COLLABORATION`)**: Agent session counts, subtask assignments, handoffs, completion rates, disconnects.
6. **Planning & Execution (`PLANNING_AND_EXECUTION`)**: Plans created, validation failures, blocked durations, revisions, verification pass rates.
7. **Learning Intelligence (`LEARNING_INTELLIGENCE`)**: Feedback volume, candidates generated, acceptance rates, deployed changes, rollbacks.
8. **Plugin Intelligence (`PLUGIN_INTELLIGENCE`)**: Registered/enabled plugins, invocations, failure rates, timeouts, permission denials.
9. **Reliability & Operations (`RELIABILITY_AND_OPERATIONS`)**: API request volume, error rates, p95 latencies, background job failures.
10. **Security & Governance (`SECURITY_AND_GOVERNANCE`)**: Authorization denials, policy violations, permission changes, audit coverage.

---

## 6. Deterministic Grounded Insights

Instead of relying on ungrounded language model heuristics, Phase 9.9 features a deterministic rule engine (`DeterministicInsightEngine`):
- **Elevated Task Failure Rate**: Triggered when `agent.task_completion_rate.percentage` < 80%.
- **Task Dependency Bottleneck**: Triggered when `planning.blocked_task_duration.ms` > 60,000ms.
- **Verification Quality Gate**: Triggered when `planning.verification_pass_rate.percentage` < 90%.
- **Plugin Degradation**: Triggered when `plugin.failure_rate.percentage` > 10% or timeouts > 0.
- **Security Authorization Denials**: Triggered when `security.authorization_denials.count` > 0.
- **Stale Repository Knowledge**: Triggered when `repo.analysis_freshness.seconds` > 7 days.

Every insight carries `evidenceReferences` linking directly to the metric ID, observed value, and expected threshold.

---

## 7. API & CLI Integration

### REST API Endpoints
- `GET /analytics/metrics`: List metric specifications (supports `?category=...`).
- `GET /analytics/metrics/:metricId`: Inspect metric specification.
- `POST /analytics/query`: Query aggregated metrics for a defined scope, window, and metric IDs.
- `POST /analytics/snapshots`: Generate an immutable snapshot.
- `GET /analytics/snapshots/:snapshotId`: Retrieve an existing snapshot.
- `POST /analytics/reports`: Generate a structured report (`OVERVIEW`, `PLATFORM_USAGE`, etc.).
- `GET /analytics/reports`: List generated reports for scope.
- `GET /analytics/reports/:reportId`: Retrieve a reproducible report by ID.
- `POST /analytics/compare`: Compare two time windows for trend analysis.
- `GET /analytics/insights`: Retrieve active deterministic insights.
- `GET /analytics/quality`: Inspect data quality and telemetry freshness.

### CLI Commands
```bash
# Display executive overview
projectmind analytics overview --workspace ws-demo

# List available metrics in JSON format
projectmind analytics metrics --category CONTEXT_INTELLIGENCE --json

# Query specific metric for the last 7 days
projectmind analytics query --metric context.assembly_latency.ms --window LAST_7D

# Generate a governance report
projectmind analytics report --type GOVERNANCE

# Compare week-over-week trends
projectmind analytics compare --window LAST_7D

# Inspect data quality and missing metrics
projectmind analytics quality

# Inspect system insights
projectmind analytics insights
```

---

## 8. Background Jobs

Integrated into the existing `JobType` platform:
- `ANALYTICS_SNAPSHOT_GENERATION`: Asynchronous snapshot creation for active workspaces with progress reporting.
- `ANALYTICS_MAINTENANCE`: Retention pruning that removes raw observation records older than retention window (default 90 days) while preserving immutable snapshots and reports.
