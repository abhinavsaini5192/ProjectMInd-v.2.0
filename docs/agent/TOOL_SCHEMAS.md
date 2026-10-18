# Tool Protocol Schemas (Phase 7.2)

This document contains the complete JSON Schemas for the canonical tools exposed by ProjectMind. All schemas strictly adhere to JSON Schema Draft 7 / OpenAPI 3.0 standards.

---

## 1. Context Orchestration Schemas

### `projectmind_get_context`
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "projectmind_get_context",
  "type": "object",
  "properties": {
    "taskId": {
      "type": "string",
      "description": "Unique identifier for the task or prompt requiring context",
      "minLength": 1
    },
    "featureId": {
      "type": "string",
      "description": "Optional feature identifier to scope context retrieval",
      "minLength": 1
    },
    "targetFiles": {
      "type": "array",
      "description": "Optional explicit file paths to anchor context retrieval",
      "items": { "type": "string" },
      "maxItems": 50
    },
    "tokenBudget": {
      "type": "integer",
      "description": "Maximum token budget for the context package (default: 8000)",
      "minimum": 100,
      "maximum": 200000,
      "default": 8000
    },
    "depth": {
      "type": "string",
      "description": "Context resolution depth (L0=signatures, L1=definitions, L2=expanded, L3=full)",
      "enum": ["L0", "L1", "L2", "L3"],
      "default": "L1"
    },
    "intent": {
      "type": "string",
      "description": "Task intent driving context ranking and selection",
      "enum": ["IMPLEMENTATION", "EXPLANATION", "REFACTORING", "DEBUGGING", "REVIEW"],
      "default": "IMPLEMENTATION"
    }
  },
  "required": ["taskId"],
  "additionalProperties": false
}
```

---

## 2. Feature Intelligence Schemas

### `projectmind_get_feature`
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "projectmind_get_feature",
  "type": "object",
  "properties": {
    "featureId": {
      "type": "string",
      "description": "Unique feature identifier",
      "minLength": 1
    },
    "includeDependencies": {
      "type": "boolean",
      "description": "Include dependency graph relationships (default: false)",
      "default": false
    },
    "includeMappings": {
      "type": "boolean",
      "description": "Include file, class, and method code mappings (default: false)",
      "default": false
    },
    "includeHealth": {
      "type": "boolean",
      "description": "Include feature health and stability assessment (default: false)",
      "default": false
    }
  },
  "required": ["featureId"],
  "additionalProperties": false
}
```

---

## 3. Reporting Schemas

### `projectmind_report_execution`
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "projectmind_report_execution",
  "type": "object",
  "properties": {
    "taskId": {
      "type": "string",
      "description": "Identifier of the executed task",
      "minLength": 1
    },
    "status": {
      "type": "string",
      "description": "Current execution status of the task",
      "enum": ["STARTED", "IN_PROGRESS", "COMPLETED", "FAILED"]
    },
    "modifiedFiles": {
      "type": "array",
      "description": "Files touched, altered, or created during execution",
      "items": { "type": "string" }
    },
    "summary": {
      "type": "string",
      "description": "Concise summary of changes made or actions executed",
      "minLength": 1,
      "maxLength": 5000
    },
    "operationId": {
      "type": "string",
      "description": "Unique client-supplied operation ID for idempotency deduplication"
    }
  },
  "required": ["taskId", "status", "summary"],
  "additionalProperties": false
}
```
