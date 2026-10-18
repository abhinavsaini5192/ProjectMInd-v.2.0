# Project Configuration & Settings Precedence — Phase 9.2

## 1. Overview

ProjectMind separates **Configuration** (declarative parameters governing behavior) from **Knowledge/State** (derived architectural graphs, symbols, and snapshots).

Each [Project](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/docs/workspaces/PROJECT_MODEL.md) maintains its own fine-grained configuration governed by [ProjectConfiguration.ts](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/workspace/models/ProjectConfiguration.ts).

---

## 2. Configuration Categories

Project configuration is categorized into five functional sections:

```typescript
export interface ProjectSettings {
  readonly analysis: ProjectAnalysisSettings;
  readonly context: ProjectContextSettings;
  readonly features: ProjectFeatureSettings;
  readonly agent: ProjectAgentSettings;
  readonly security: ProjectSecuritySettings;
  readonly custom?: Readonly<Record<string, unknown>>;
}
```

### Analysis Settings
Controls code scanning, AST parsing depth, and repository file filters:
- `autoScan`: Boolean flag determining whether repository changes trigger automatic incremental re-scans.
- `defaultBranch`: Primary branch tracked for continuous intelligence (e.g. `'main'`).
- `excludePatterns`: Glob patterns ignored during scanning (`['node_modules/**', 'dist/**', '.git/**']`).
- `maxFileSizeBytes`: Cap on individual file sizes parsed into the symbol graph (default: 2MB).

### Context Settings
Directly controls how the [Context Orchestrator](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/context/orchestration/ContextOrchestrator.ts) packs prompts for LLMs and agents:
- `defaultTokenBudget`: Default maximum tokens allocated for context packages (default: 4,000).
- `packingStrategy`: Context packaging algorithm (`PROPORTIONAL_DYNAMIC`, `GREEDY`, `HIERARCHICAL`).
- `maxIncludedFiles`: Limit on distinct file snippets embedded in a context package (default: 25).
- `enableMarkdownCompression`: Compresses whitespace and removes redundant comments in context packages.

### Feature Settings
Governs business feature detection:
- `discoveryEnabled`: Activates automatic domain feature detection.
- `autoTagging`: Synthesizes tags from directory names and semantic terms.
- `healthThreshold`: Minimum confidence score (0-100) required to consider a feature healthy.

### Agent Settings
Defines execution constraints for agent runtimes operating on the project:
- `maxConcurrentSessions`: Concurrency ceiling for simultaneous agent sessions (default: 10).
- `allowedTools`: Whitelist of tools executable by agents within the project scope.
- `requireHumanApprovalForExecution`: Requires explicit developer confirmation before executing mutating tools.

### Security Settings
Project-level security policy:
- `enforceWorkspaceIsolation`: Mandatory strict isolation preventing cross-workspace data leakage.
- `allowCrossRepoAnalysis`: Allows semantic queries to traverse repositories attached to the *same* project.
- `secretRedactionEnabled`: Automatic masking of API tokens, private keys, and passwords.

---

## 3. Configuration Precedence Order

When resolving configuration for a command, task, or agent session, settings resolve in deterministic hierarchical order:

```text
Level 1: Platform Global Defaults (Immutable Baseline)
    ↓
Level 2: Workspace Settings (Tenant-Wide Policies)
    ↓
Level 3: Project Configuration (Project-Specific Settings)
    ↓
Level 4: Task / Session Request Overrides (Ephemeral Execution Options)
```

### Non-Overridable Security Invariants
Certain platform security invariants **cannot be overridden** by lower levels:
- A project configuration **cannot** disable `enforceWorkspaceIsolation` if enabled at the workspace or platform level.
- Secrets redaction **cannot** be disabled on standard security tiers.
- A task override **cannot** elevate allowed tools beyond the project's whitelist.
