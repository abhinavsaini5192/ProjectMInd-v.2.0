# Errors & Troubleshooting Guide

## Error Hierarchy

All context orchestration errors inherit from `Error` and provide structured context:

| Error Class | Code | Cause |
| :--- | :--- | :--- |
| `ContextPlanningError` | `CONTEXT_PLANNING_ERROR` | Missing repositoryId/workspaceId, invalid token budget, no targets provided |
| `ContextRetrievalError` | `CONTEXT_RETRIEVAL_ERROR` | Subsystem network/storage failure when fetching from FeatureKnowledgeAPI |
| `ContextBudgetError` | `CONTEXT_BUDGET_ERROR` | Impossible budget constraints or severe token overallocation |
| `ContextPackingError` | `CONTEXT_PACKING_ERROR` | Failure to build package or integrity corruption |
| `UnsupportedContextFormatError` | `UNSUPPORTED_CONTEXT_FORMAT` | Requested format is not registered in `AdapterRegistry` |
| `ContextOrchestrationError` | `CONTEXT_ORCHESTRATION_ERROR` | General unhandled failure during orchestration execution |

## Warning Types (`ContextWarningType`)

Warnings do not throw exceptions; they are returned inside `package.warnings` and `response.warnings`:

- `STALE_KNOWLEDGE`: Feature knowledge is older than freshness threshold.
- `BUDGET_EXCEEDED`: Initial selected content exceeded available token budget.
- `TRUNCATED_CONTENT`: Low-priority files or flows were pruned.
- `OMITTED_SECTION`: An entire section was dropped due to tight budget.
- `UNRESOLVED_FEATURE`: A requested feature could not be found in the knowledge base.
- `CIRCULAR_DEPENDENCY`: A cycle was detected in the feature dependency graph.
- `PARTIAL_PROVIDER_FAILURE`: A specific subsystem failed during retrieval.

## Troubleshooting

1. **Empty Feature List in Context**:
   - Check that `taskText` contains keywords matching feature names or tags.
   - Or explicitly provide `featureIds: ['feat_...']` in `ContextRequest`.
2. **Missing Code Snippets**:
   - Verify if `compactMode` was activated. If `tokenBudget < 2000`, compact mode automatically strips snippets to fit file paths. Increase `tokenBudget` to >= 4000.
3. **Format Not Recognized**:
   - Verify format is one of: `'generic-markdown'`, `'claude-xml'`, `'openai-markdown'`, `'gemini-markdown'`, `'cursor-compact'`, `'codex-code'`, `'json'`.
