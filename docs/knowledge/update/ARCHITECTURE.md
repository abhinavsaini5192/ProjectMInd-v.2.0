# Knowledge Update Loop Architecture

## Architectural Principles

Phase 7.8 adheres strictly to ProjectMind's non-negotiable architectural constraints:

1. **Passive Repository Intelligence**: ProjectMind never executes shell commands, compilers, linters, or test suites. Autonomous execution is forbidden. All external evidence arrives as observations (Phase 7.6) or verification payloads (Phase 7.7).
2. **Strict Incremental Isolation**: When a specific resource changes (e.g. `src/auth/AuthService.ts`), only directly related knowledge subgraphs (e.g. `feat-auth`) are analyzed or updated. Completely unrelated features (e.g. `feat-payment`) remain untouched.
3. **No Duplicate Infrastructure**: Reuses existing Feature Intelligence engines (`IFeatureMappingEngine`, `IFeatureDependencyEngine`, `IFeatureHealthEngine`, `IFeatureHistoryEngine`), Context Orchestrator (`IAgentContextSessionManager`), and Storage providers.
4. **Deterministic Versioning**: Monotonic knowledge versions (`K1`, `K2`, ...) are created exclusively when canonical knowledge areas change.

## Core Component Pipeline

```
              ┌──────────────────────────────────────────────┐
              │              Incoming Update                 │
              │ (Observation / Verification / Tool / Manual) │
              └──────────────────────┬───────────────────────┘
                                     │
                                     ▼
                      [ KnowledgeUpdateNormalizer ]
                      - Trims identifiers & paths
                      - Canonical POSIX paths
                      - Deterministic idempotency key
                                     │
                                     ▼
                     [ KnowledgeUpdateDeduplicator ]
                      - Idempotency key lookup
                      - Fast-path replay for applied
                                     │
                                     ▼
                      [ KnowledgeUpdateValidator ]
                      - Scope & workspace validation
                      - Directory traversal rejection
                      - Anti-forging provenance check
                      - Secret token redaction
                                     │
                                     ▼
                      [ KnowledgeImpactResolver ]
                      - Resource-to-Feature projection
                      - Downstream dependency fanout
                      - Area inference (Health/History)
                                     │
                                     ▼
                       [ KnowledgeUpdatePlanner ]
                      - Directed acyclic stage planning
                      - Explicit operation dependencies
                      - Invalidation & refresh targets
                                     │
                                     ▼
                      [ KnowledgeUpdateExecutor ]
                      - Incremental feature engine dispatch
                      - Error isolation per area
                                     │
                                     ▼
                     [ KnowledgeUpdateProcessor ]
                      - Conflict detection & precedence
                      - Version advancement check
                      - Cache invalidation issuance
                      - Session context refresh policy
                                     │
                                     ▼
                      [ KnowledgeUpdateExplainer ]
                      - Human & agent readable summary
```

## Dependency Injection (DI) Tokens

Registered in `src/knowledge/update/di/KnowledgeUpdateTokens.ts`:

- `KNOWLEDGE_UPDATE_REPOSITORY`: `IKnowledgeUpdateRepository`
- `KNOWLEDGE_UPDATE_NORMALIZER`: `KnowledgeUpdateNormalizer`
- `KNOWLEDGE_UPDATE_DEDUPLICATOR`: `KnowledgeUpdateDeduplicator`
- `KNOWLEDGE_UPDATE_VALIDATOR`: `IKnowledgeUpdateValidator`
- `KNOWLEDGE_IMPACT_RESOLVER`: `IKnowledgeImpactResolver`
- `KNOWLEDGE_UPDATE_PLANNER`: `IKnowledgeUpdatePlanner`
- `KNOWLEDGE_UPDATE_EXECUTOR`: `IKnowledgeUpdateExecutor`
- `KNOWLEDGE_VERSION_MANAGER`: `IKnowledgeVersionManager`
- `KNOWLEDGE_INVALIDATION_MANAGER`: `IKnowledgeInvalidationManager`
- `KNOWLEDGE_REFRESH_MANAGER`: `IKnowledgeRefreshManager`
- `KNOWLEDGE_UPDATE_RUN_MANAGER`: `KnowledgeUpdateRunManager`
- `KNOWLEDGE_UPDATE_PROCESSOR`: `IKnowledgeUpdateProcessor`
- `KNOWLEDGE_UPDATE_COORDINATOR`: `IKnowledgeUpdateCoordinator`
- `KNOWLEDGE_UPDATE_EXPLAINER`: `IKnowledgeUpdateExplainer`
- `EXECUTION_OBSERVATION_ADAPTER`: `ExecutionObservationAdapter`
- `VERIFICATION_EVIDENCE_ADAPTER`: `VerificationEvidenceAdapter`
