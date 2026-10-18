# Performance & Scalability Guarantees

## Algorithmic Complexity

| Component / Stage | Complexity | Guarantee |
| :--- | :--- | :--- |
| **Normalizer** | $O(R + F)$ | Linear in count of supplied resources ($R$) and features ($F$). Zero I/O. |
| **Deduplicator** | $O(1)$ | Hash-indexed idempotency lookup. |
| **Validator** | $O(R)$ | Regex matching on file paths and secret token sanitization. Zero disk reads. |
| **Impact Resolver** | $O(R + k)$ | Direct resource-to-feature lookup ($O(R)$) plus bounded downstream fanout ($k \le \text{MAX\_FANOUT}$). |
| **Planner** | $O(F + O)$ | DAG staging of operations ($O$) across affected features ($F$). |
| **Executor** | $O(O_{\text{incremental}})$ | Targeted incremental dispatch. Never rescans entire repo. |
| **Version Advancement** | $O(1)$ | Sequential version counter and metadata recording. |
| **Invalidation Manager** | $O(T)$ | Targeted cache key invalidation for affected targets ($T$). |

## Zero Full-Scan Invariant

ProjectMind strictly enforces that normal update paths never execute:
- Full repository scans (e.g. `walkDir`, `find .`, full AST traversals).
- Repository extraction passes.
- Git tree re-evaluations.

Updates touch **only** the delta between the previous knowledge state and the incoming observation or verification payload.

## Batch Processing & Run Optimization

- Multi-update payloads (e.g. from bulk test suite completions or git commits touching 20 files) are ingested via `processKnowledgeUpdates(...)`.
- The `KnowledgeUpdateRunManager` groups changes, performs batch deduplication, and creates a unified `KnowledgeUpdateRun` record.
- Invalidation events are aggregated to avoid thundering-herd re-evaluations in active agent sessions.
