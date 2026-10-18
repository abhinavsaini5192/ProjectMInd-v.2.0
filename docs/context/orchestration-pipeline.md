# Context Orchestration Pipeline

## Pipeline Execution Stages

When `IContextOrchestrator.orchestrateContext(request)` is called, the request transitions through eight distinct, deterministic stages:

### Stage 1: Validation & Request Normalization
- `ContextPlanValidator` verifies that required identifiers (`repositoryId`, `workspaceId`) are non-empty strings.
- Verifies that at least one context targeting parameter is present (`featureIds`, `changedResources`, `resourceIds`, `taskText`, or `taskIntent`).
- `ContextRequestResolver` resolves defaults: `tokenBudget` (default 4000), `maxDepth` (default 1), `outputFormat` (default `generic-markdown`), `freshnessPolicy` (default `CURRENT`), and `compactMode`.

### Stage 2: Cache Evaluation
- `ContextCacheKeyBuilder` creates a deterministic hash key from the normalized request parameters.
- If `freshnessPolicy !== 'CURRENT'`, the orchestrator checks `ContextCache`. On cache hit, returns cached `ContextResponse` with `cached: true`.

### Stage 3: Planning & Budget Quota Allocation
- `ContextPlanner.planContext()` computes required sections and priority weights.
- `ContextPlanBuilder` reserves prompt and metadata headroom, computes `availableForContext`, and allocates proportional section quotas.

### Stage 4: Knowledge Retrieval
- `ContextRetrievalCoordinator` delegates to `FeatureContextRetriever` which calls `IFeatureKnowledgeAPI.getFeatureKnowledge`.
- Traverses downstream feature dependencies up to `plan.maxDepth`.
- Retrieves impact analysis for modified resources.
- Collects warnings for unresolved entities.

### Stage 5: Selection & Multi-Factor Scoring
- `ContextFeatureSelector` scores features using directness, task alignment, and architectural importance.
- `ContextResourceSelector` scores mapped resources, elevating primary entry points and modified files.
- `ContextDeduplicator` eliminates duplicate files across overlapping features while preserving highest-priority scores.

### Stage 6: Token Budget Enforcement & Pruning
- `TokenBudgetManager.applyBudget()` checks if total content exceeds section quotas.
- If compact mode is active, `ContextCompressionPolicy` compresses descriptions and strips snippets.
- `ContextTruncationPolicy` prunes items exceeding section quotas and records `TRUNCATED_CONTENT` warnings.

### Stage 7: Canonical Package Assembly & Sanitization
- `ContextPackageBuilder` binds cross-references between features, resources, and flows.
- `ContextMetadataPacker` computes completeness level (`FULL`, `HIGH`, `PARTIAL`, `MINIMAL`), freshness, and version consistency.
- `ContextIntegrityValidator` detects circular dependency cycles and redacts secrets (passwords, bearer tokens, API keys).

### Stage 8: Model Adaptation & Response Delivery
- `AdapterRegistry` retrieves the appropriate `IModelContextAdapter` for `request.outputFormat`.
- The adapter formats the canonical package into target prompt text (`claude-xml`, `openai-markdown`, `gemini-markdown`, etc.) and attaches it to `pkg.compiledPromptText`.
- Stores the final `ContextResponse` in cache.
- Returns `ContextResponse` to caller.
