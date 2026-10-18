# Canonical Tool Catalog (Phase 7.2)

ProjectMind exposes **12 canonical tools** organized into 6 functional categories. All tools are strictly `READ_ONLY` (context retrieval & memory queries) or `REPORT_ONLY` (feedback & insight ingestion).

---

## 1. Context Orchestration Tools

### `projectmind_get_context`
- **Category**: `CONTEXT`
- **Safety**: `READ_ONLY`
- **Capability**: `CONTEXT_REQUEST`
- **Scope**: `WORKSPACE_REQUIRED`
- **Description**: Retrieve an optimized, token-budgeted, deterministic context package for a specific development task.
- **Inputs**:
  - `taskId` (string, required): Unique task/prompt identifier.
  - `featureId` (string, optional): Feature anchor to narrow context scope.
  - `targetFiles` (string[], optional): Explicit file paths to include.
  - `tokenBudget` (integer, optional, default: 8000): Maximum tokens allocated.
  - `depth` (string enum: `L0` | `L1` | `L2` | `L3`, default: `L1`).
  - `intent` (string enum: `IMPLEMENTATION` | `EXPLANATION` | `REFACTORING` | `DEBUGGING` | `REVIEW`).
- **Outputs**: `{ taskId, packageId, tokensUsed, confidence, resources, plan }`

### `projectmind_explain_context`
- **Category**: `CONTEXT`
- **Safety**: `READ_ONLY`
- **Capability**: `CONTEXT_EXPLANATION`
- **Scope**: `WORKSPACE_REQUIRED`
- **Description**: Explain why specific files, features, and snippets were included in a generated context package.
- **Inputs**:
  - `packageId` (string, required): Identifier of context package to explain.
- **Outputs**: `{ packageId, reasons, scoringBreakdown, explanation }`

### `projectmind_refresh_context`
- **Category**: `CONTEXT`
- **Safety**: `READ_ONLY`
- **Capability**: `CONTEXT_REFRESH`
- **Scope**: `WORKSPACE_REQUIRED`
- **Description**: Re-evaluate and refresh a context package after local workspace modifications.
- **Inputs**:
  - `packageId` (string, required): Identifier of existing package.
  - `modifiedFiles` (string[], optional): Files touched since generation.
- **Outputs**: `{ packageId, refreshed, changes, newTokens }`

---

## 2. Feature Intelligence Tools

### `projectmind_get_feature`
- **Category**: `FEATURE`
- **Safety**: `READ_ONLY`
- **Capability**: `FEATURE_QUERY`
- **Scope**: `WORKSPACE_REQUIRED`
- **Description**: Query structural, behavioral, and architectural knowledge about a discovered feature.
- **Inputs**:
  - `featureId` (string, required): Feature identifier.
  - `includeDependencies` (boolean, optional, default: false).
  - `includeMappings` (boolean, optional, default: false).
  - `includeHealth` (boolean, optional, default: false).
- **Outputs**: `{ found, feature }`

### `projectmind_get_feature_context`
- **Category**: `FEATURE`
- **Safety**: `READ_ONLY`
- **Capability**: `TASK_CONTEXT`
- **Scope**: `WORKSPACE_REQUIRED`
- **Description**: Retrieve context packaged specifically around a feature's boundaries, dependencies, and code assets.
- **Inputs**:
  - `featureId` (string, required): Feature identifier.
  - `tokenBudget` (integer, optional, default: 8000).
  - `includeRelatedFeatures` (boolean, optional, default: true).
- **Outputs**: `{ featureId, packageId, resources, tokensUsed, confidence }`

---

## 3. Impact & Architecture Tools

### `projectmind_get_impact`
- **Category**: `IMPACT`
- **Safety**: `READ_ONLY`
- **Capability**: `IMPACT_QUERY`
- **Scope**: `WORKSPACE_REQUIRED`
- **Description**: Analyze direct and propagated change impact for a set of modified or planned files/features.
- **Inputs**:
  - `featureId` (string, optional): Feature identifier.
  - `modifiedFiles` (string[], optional): List of modified files.
  - `depth` (integer, optional, default: 2, range 1-5).
- **Outputs**: `{ featureId, depth, impact, affectedFeatures, affectedFiles }`

### `projectmind_get_architecture`
- **Category**: `ARCHITECTURE`
- **Safety**: `READ_ONLY`
- **Capability**: `ARCHITECTURE_QUERY`
- **Scope**: `WORKSPACE_REQUIRED`
- **Description**: Retrieve architectural graph, dependency topologies, and component boundaries of the workspace.
- **Inputs**:
  - `featureId` (string, optional): Anchor feature.
  - `includeExternal` (boolean, optional, default: false).
  - `maxDepth` (integer, optional, default: 3, range 1-10).
- **Outputs**: `{ featureId, components, boundaries, dependencies, raw }`

---

## 4. History & Evolution Tools

### `projectmind_get_history`
- **Category**: `HISTORY`
- **Safety**: `READ_ONLY`
- **Capability**: `HISTORY_QUERY`
- **Scope**: `WORKSPACE_REQUIRED`
- **Description**: Retrieve chronological evolution, refactorings, drift, and version history of a feature.
- **Inputs**:
  - `featureId` (string, required): Feature identifier.
  - `limit` (integer, optional, default: 20, range 1-100).
  - `sinceTimestamp` (string, optional): ISO-8601 date cutoff.
- **Outputs**: `{ featureId, timeline, totalEvents, versionCount, maturityLevel }`

---

## 5. Health & Risk Tools

### `projectmind_get_health`
- **Category**: `HEALTH`
- **Safety**: `READ_ONLY`
- **Capability**: `HEALTH_QUERY`
- **Scope**: `WORKSPACE_REQUIRED`
- **Description**: Query health scores, stability indices, risk metrics, and test coverage of features.
- **Inputs**:
  - `featureId` (string, required): Feature identifier.
- **Outputs**: `{ featureId, healthScore, stability, riskFactors, criticalityScore, raw }`

---

## 6. Reporting & Feedback Tools

### `projectmind_report_execution`
- **Category**: `EXECUTION`
- **Safety**: `REPORT_ONLY`
- **Capability**: `EXECUTION_REPORT`
- **Scope**: `SESSION_REQUIRED`
- **Description**: Report task execution progress, changes made, and status back to ProjectMind.
- **Inputs**:
  - `taskId` (string, required).
  - `status` (string enum: `STARTED` | `IN_PROGRESS` | `COMPLETED` | `FAILED`, required).
  - `summary` (string, required, max length 5000).
  - `modifiedFiles` (string[], optional).
  - `operationId` (string, optional): Idempotency key.
- **Outputs**: `{ taskId, status, acknowledged: true, recordedAt, filesCount }`

### `projectmind_report_verification`
- **Category**: `VERIFICATION`
- **Safety**: `REPORT_ONLY`
- **Capability**: `VERIFICATION_REPORT`
- **Scope**: `SESSION_REQUIRED`
- **Description**: Report test outcomes, lint results, and verification feedback for completed code changes.
- **Inputs**:
  - `taskId` (string, required).
  - `passed` (boolean, required).
  - `summary` (string, required, max length 5000).
  - `testResults` (object[], optional).
  - `diagnostics` (string[], optional).
  - `operationId` (string, optional): Idempotency key.
- **Outputs**: `{ taskId, passed, recorded: true, recordedAt, diagnosticsCount }`

### `projectmind_update_knowledge`
- **Category**: `KNOWLEDGE`
- **Safety**: `REPORT_ONLY`
- **Capability**: `KNOWLEDGE_UPDATE`
- **Scope**: `SESSION_REQUIRED`
- **Description**: Report discovered feature insights or architectural annotations to be incorporated into project memory.
- **Inputs**:
  - `featureId` (string, required).
  - `insights` (string[], required, min items 1, max items 50).
  - `confidence` (number, optional, range 0-1, default: 0.8).
  - `operationId` (string, optional): Idempotency key.
- **Outputs**: `{ featureId, stored: true, insightsRecorded, confidence, recordedAt }`
