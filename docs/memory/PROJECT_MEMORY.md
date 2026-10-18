# Project Memory System

## 1. Overview & Separation from Transcripts

Project memory represents durable knowledge about a software project over time.

```
┌─────────────────────────────────────────────────────────────┐
│                 CRITICAL MEMORY DISTINCTIONS                 │
├─────────────────────────────────────────────────────────────┤
│  Knowledge: "What is currently true about the repository?"   │
│  History:   "What changed?"                                 │
│  Memory:    "What meaningful information should ProjectMind │
│              remember about the project?"                   │
│  Chat:      Raw transcripts (never project memory by default)│
└─────────────────────────────────────────────────────────────┘
```

Project memory is **NOT** a chat transcript dumping ground. Transient conversational turns, syntax fixes, and routine commits are not stored. Only meaningful, durable architectural decisions, conventions, migration milestones, and incident post-mortems are recorded.

## 2. Memory Categories

Memories are classified into 16 distinct categories defined in [MemoryEnums.ts](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/memory/project/models/MemoryEnums.ts):
- `TECHNICAL`
- `ARCHITECTURE`
- `DECISION`
- `FEATURE`
- `TASK`
- `BUG`
- `INCIDENT`
- `DEPENDENCY`
- `CONFIGURATION`
- `SECURITY`
- `PERFORMANCE`
- `MIGRATION`
- `DEPRECATION`
- `TEAM`
- `OPERATIONAL`
- `UNKNOWN`

## 3. Scoping & Security

Memories are strictly partitioned by:
- `workspaceId`: Workspace isolation.
- `projectId`: Project isolation.
- `repositoryId`: Repository identity.

Cross-project leakage is strictly prohibited. An agent or developer working in Project B cannot access memory records partitioned under Project A.
