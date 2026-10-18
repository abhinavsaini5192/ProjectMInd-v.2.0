# MCP Tool Mapping Reference

All ProjectMind MCP tools are dynamically translated from canonical Phase 7.2 tool definitions into MCP-compliant tools with JSON Schema Draft-7 input schemas.

---

## 1. Canonical Tool Mapping Matrix

| MCP Tool Name | Safety Level | Category | Required Scope | Primary Purpose |
|---|---|---|---|---|
| `projectmind_get_context` | `READ_ONLY` | CONTEXT | WORKSPACE_REQUIRED | Orchestrate optimized context package for a specific coding task. |
| `projectmind_get_feature` | `READ_ONLY` | FEATURE | WORKSPACE_REQUIRED | Retrieve complete profile and identity of a domain feature. |
| `projectmind_get_feature_context` | `READ_ONLY` | CONTEXT | WORKSPACE_REQUIRED | Retrieve focused context bounded to a set of features. |
| `projectmind_get_impact` | `READ_ONLY` | IMPACT | WORKSPACE_REQUIRED | Calculate blast radius and impacted dependencies for changed files/features. |
| `projectmind_get_architecture` | `READ_ONLY` | ARCHITECTURE | WORKSPACE_REQUIRED | Inspect workspace architecture, subsystem boundaries, and topologies. |
| `projectmind_get_history` | `READ_ONLY` | HISTORY | WORKSPACE_REQUIRED | Retrieve evolution timeline, commit history, and milestone records. |
| `projectmind_get_health` | `READ_ONLY` | HEALTH | WORKSPACE_REQUIRED | Retrieve quality metrics, technical debt, and risk signals. |
| `projectmind_explain_context` | `READ_ONLY` | EXPLANATION | WORKSPACE_REQUIRED | Explain selection and ranking rationale behind context elements. |
| `projectmind_refresh_context` | `READ_ONLY` | CONTEXT | WORKSPACE_REQUIRED | Refresh existing context package after local file changes. |
| `projectmind_report_execution` | `REPORT_ONLY` | EXECUTION | SESSION_REQUIRED | Report execution status, file changes, and completion progress. |
| `projectmind_report_verification` | `REPORT_ONLY` | VERIFICATION | SESSION_REQUIRED | Report test, lint, and validation outcomes. |
| `projectmind_update_knowledge` | `REPORT_ONLY` | KNOWLEDGE | SESSION_REQUIRED | Propose corrections or additions to repository knowledge graph. |

---

## 2. Canonical Tool Signatures & Schemas

### `projectmind_get_context`
- **Parameters**:
  - `taskId` (string, required): Task description or identifier.
  - `taskType` (enum, optional): `'FEATURE' | 'BUG' | 'REFACTOR' | 'TEST' | 'MIGRATION' | 'INVESTIGATION' | 'UNKNOWN'`.
  - `featureIds` (string[], optional): Scoped feature IDs.
  - `tokenBudget` (integer, optional): Maximum tokens (100 to 128000, default 8000).
  - `format` (enum, optional): `'MARKDOWN' | 'JSON' | 'SYSTEM_PROMPT' | 'STRUCTURED'`.
  - `targetFiles` (string[], optional): Targeted source paths.

### `projectmind_get_feature`
- **Parameters**:
  - `featureId` (string, required): Feature ID to query.
  - `includeDependencies` (boolean, optional): Include upstream/downstream dependencies.
  - `includeMappings` (boolean, optional): Include mapped source files and symbols.
  - `includeHealth` (boolean, optional): Include health scores and risks.

### `projectmind_get_impact`
- **Parameters**:
  - `featureId` (string, optional): Feature ID to inspect.
  - `modifiedFiles` (string[], optional): Changed files to assess blast radius.
  - `depth` (integer, optional): Maximum propagation depth (1 to 5, default 2).

### `projectmind_report_execution`
- **Parameters**:
  - `taskId` (string, required): Unique task ID.
  - `status` (enum, required): `'STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'`.
  - `summary` (string, required): Summary of actions taken.
  - `modifiedFiles` (string[], optional): Files touched during execution.
  - `operationId` (string, optional): Client-supplied idempotency key.
