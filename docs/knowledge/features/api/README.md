# Phase 6.9 — Feature Knowledge API

## Overview

The **Feature Knowledge API** provides a unified, provider-independent, read-oriented query surface that exposes all available knowledge about a feature through one canonical entry point.

Before Phase 6.9, ProjectMind maintained independent subsystems for:
- Feature Identity (Phase 6.1)
- Feature Discovery (Phase 6.2)
- Feature-to-Code Mapping (Phase 6.3)
- Feature Dependencies & Relationships (Phase 6.4)
- Feature Behavior & Execution Flows (Phase 6.5)
- Feature Health & Risks (Phase 6.6)
- Feature Change Impact (Phase 6.7)
- Feature History & Evolution (Phase 6.8)

Phase 6.9 introduces the unified orchestrator:
```typescript
const profile = await api.getFeatureKnowledge('Authentication');
```
This returns a structured, consolidated knowledge profile aggregating evidence from all subsystems while preserving read-only guarantees, strict workspace boundaries, deterministic serialization, and query planning efficiency.

---

## Key Capabilities

1. **Unified Query Surface**: Clients call `getFeatureKnowledge(...)` instead of orchestrating 8 separate subsystem repositories.
2. **Selective & Section-Based Queries**: Clients specify only the sections they need (e.g. `['IDENTITY', 'MAPPINGS']`). The query planner ensures unrequested subsystems are never invoked.
3. **Partial Failure Resilience**: If an individual subsystem fails or is unconfigured, other sections still succeed and the failure is isolated and explicitly reported.
4. **Distinct Knowledge States**: Distinguishes between `AVAILABLE`, `EMPTY`, `NOT_REQUESTED`, `NOT_COMPUTED`, `STALE`, `PARTIAL`, `FAILED`, and `INACCESSIBLE`.
5. **Dual Completeness & Confidence Models**: Separates completeness ("How much expected knowledge is available?") from confidence ("How trustworthy is the available evidence?").
6. **Freshness & Version Consistency**: Evaluates data age and detects version mismatches across subsystems and query requirements.
7. **Bounded Context Package**: Assembles a compact, deterministic representation prioritized for LLM context windows (tokens, entry points, primary resources, high-severity risks).
8. **Stable Serialization & Sanitization**: Redacts sensitive tokens/secrets and guarantees deterministic key ordering without circular references.

---

## Documentation Index

- [FEATURE_KNOWLEDGE_API.md](./FEATURE_KNOWLEDGE_API.md) — API interfaces, methods, and usage examples.
- [ARCHITECTURE.md](./ARCHITECTURE.md) — System design, non-duplication principles, and subsystem delegation.
- [QUERY_MODEL.md](./QUERY_MODEL.md) — Query parameters, section filters, options, and validation.
- [RESPONSE_MODEL.md](./RESPONSE_MODEL.md) — Unified response structure, metadata, and DTOs.
- [SECTION_MODEL.md](./SECTION_MODEL.md) — Section statuses, data schemas, and lifecycle states.
- [COMPLETENESS_AND_CONFIDENCE.md](./COMPLETENESS_AND_CONFIDENCE.md) — Mathematical and logical evaluation of completeness vs. confidence.
- [FRESHNESS_AND_VERSIONING.md](./FRESHNESS_AND_VERSIONING.md) — Freshness evaluation, invalidation policies, and version consistency.
- [CONTEXT_PACKAGE.md](./CONTEXT_PACKAGE.md) — LLM context package generation, priority ranking, and token budgets.
- [CACHING.md](./CACHING.md) — Query key generation, memory caching, and invalidation strategies.
- [ERROR_HANDLING.md](./ERROR_HANDLING.md) — Error hierarchy, partial failure isolation, and error codes.
- [SECURITY.md](./SECURITY.md) — Scope isolation (workspace/repository), secret redaction, and read-only guarantees.
- [TESTING.md](./TESTING.md) — Synthetic test scenarios, boundary verification, and test coverage.
