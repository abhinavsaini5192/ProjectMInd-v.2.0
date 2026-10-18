# Observation Query & Canonical Tool Protocol API

## 1. Overview

Phase 7.6 introduces 4 canonical tools (expanding the Canonical Tool Protocol from 27 to 31 tools) that allow external agents and MCP clients to query execution evidence, timeline graphs, execution summaries, and conflicts.

---

## 2. Canonical Observation Tools

### 2.1. `projectmind_get_execution_observations`
Retrieves filtered and paginated execution observations.

**Input Schema**:
```json
{
  "taskId": { "type": "string", "description": "Target task identifier" },
  "type": { "type": "string", "description": "Optional observation type filter" },
  "source": { "type": "string", "description": "Optional observation source filter" },
  "affectedResource": { "type": "string", "description": "Optional resource path filter" },
  "limit": { "type": "number", "description": "Page size (default 50, max 100)" },
  "offset": { "type": "number", "description": "Pagination offset" }
}
```

**Output**:
```json
{
  "taskId": "task-101",
  "observations": [ ... ],
  "totalCount": 12,
  "totalObservations": 12,
  "limit": 50,
  "offset": 0,
  "hasMore": false
}
```

---

### 2.2. `projectmind_get_task_timeline`
Retrieves the causal, chronologically ordered timeline of observations recorded for a task.

**Input Schema**:
```json
{
  "taskId": { "type": "string", "description": "Task identifier to construct timeline for" }
}
```

**Output**:
```json
{
  "taskId": "task-101",
  "entries": [
    {
      "entryId": "entry_obs_1",
      "observationId": "obs_1",
      "timestamp": "2026-09-20T10:00:00.000Z",
      "type": "TASK_STARTED",
      "summary": "Agent started task",
      "provenance": "AGENT_REPORTED",
      "causality": "EXPLICIT",
      "affectedResources": []
    }
  ],
  "totalEntries": 1,
  "totalObservations": 1,
  "firstObservedAt": "2026-09-20T10:00:00.000Z",
  "lastObservedAt": "2026-09-20T10:00:00.000Z"
}
```

---

### 2.3. `projectmind_get_execution_summary`
Aggregates overall task execution progress, blockers, changed resources, commands, and verification outcomes.

**Input Schema**:
```json
{
  "taskId": { "type": "string", "description": "Target task identifier" }
}
```

**Output**:
```json
{
  "taskId": "task-101",
  "executionState": "COMPLETED",
  "changedResources": ["src/auth/AuthService.ts"],
  "commandsReported": ["npm test"],
  "verificationResults": {
    "buildPassed": true,
    "testsPassed": 12,
    "testsFailed": 0
  },
  "verificationResult": { "passed": true },
  "blockers": [],
  "blockersEncountered": [],
  "conflicts": [],
  "totalObservations": 6
}
```

---

### 2.4. `projectmind_get_observation_conflicts`
Retrieves all recorded conflicts and precedence resolutions for a task.

**Input Schema**:
```json
{
  "taskId": { "type": "string", "description": "Target task identifier" }
}
```

**Output**:
```json
{
  "taskId": "task-101",
  "conflicts": [
    {
      "conflictId": "conflict_1",
      "field": "verificationStatus",
      "severity": "MEDIUM",
      "resolutionStatus": "RESOLVED",
      "winnerObservationId": "obs_verif_1",
      "resolutionReason": "Resolved by trusted verification source 'VERIFICATION'"
    }
  ],
  "totalConflicts": 1
}
```
