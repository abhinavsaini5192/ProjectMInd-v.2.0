# ProjectMind CLI Command Reference

This document provides complete syntax, arguments, options, and sample output for every command available in the ProjectMind CLI.

## Global Options

All commands accept the following global flags:

| Flag | Type | Description |
|------|------|-------------|
| `--json` | Flag | Formats output as machine-readable JSON |
| `--text` | Flag | Forces human-readable colored text output |
| `--table` | Flag | Formats tabular data in text tables |
| `--verbose` | Flag | Outputs additional telemetry and evaluation metadata |
| `--debug` | Flag | Emits stack traces and internal diagnostics on error |
| `-h, --help` | Flag | Displays help information for the command |
| `-v, --version` | Flag | Displays version metadata and exits |
| `-w, --workspace <path>` | String | Explicitly sets the active workspace directory |
| `--no-telemetry` | Flag | Disables CLI telemetry event recording |

---

## Command Catalog

### `projectmind init`
Initializes ProjectMind configuration and state for the target workspace.

- **Usage:** `projectmind init [--name <repo_name>] [--force] [--json]`
- **Options:**
  - `--name <string>`: Custom repository name (defaults to directory basename).
  - `--force`: Re-initializes config even if `.projectmind/config.json` exists.
- **Idempotence:** Safe to run repeatedly; will not corrupt existing repository state.

### `projectmind status`
Displays repository identity, knowledge version, health, and snapshot counters.

- **Usage:** `projectmind status [--json]`
- **Output Data:**
  - `project`: Repository name
  - `workspace`: Absolute workspace path
  - `environment`: `production`, `development`, or `test`
  - `version`: Platform version
  - `health`: Subsystem health state (`HEALTHY`, `DEGRADED`)
  - `uptimeSeconds`: Engine uptime in seconds
  - `knowledgeVersion`: Monotonic knowledge snapshot tag
  - `snapshotsCount`: Number of stored backup snapshots

### `projectmind analyze`
Triggers repository intelligence analysis, code symbol extraction, and feature mapping.

- **Usage:** `projectmind analyze [--feature <name>] [--changed] [--refresh] [--json]`
- **Options:**
  - `--feature <name>`: Restrict analysis to symbols related to a specific feature.
  - `--changed`: Incremental analysis of only changed files.
  - `--refresh`: Force full re-indexing of workspace state.

### `projectmind context`
Generates a compact, explainable context package for AI coding agents.

- **Usage:** `projectmind context <task_description> [--feature <id>] [--budget <tokens>] [--json]`
- **Arguments:**
  - `<task_description>`: Description of the coding task or bug to address.
- **Options:**
  - `--feature <id>`: Target feature identifier to anchor the context graph.
  - `--budget <tokens>`: Maximum token budget (default: 4000).

### `projectmind feature`
Exposes the Feature Knowledge engine (catalog, code mappings, dependencies, behavior flows, health, and evolution).

- **Usage:** `projectmind feature <subcommand> [feature_id] [--json]`
- **Subcommands:**
  - `list`: Lists all registered workspace features.
  - `show <id>`: Displays comprehensive profile for a feature.
  - `mappings <id>`: Lists source files, interfaces, and test files mapped to the feature.
  - `dependencies <id>`: Inspects dependency relations and relationship strength.
  - `behavior <id>`: Displays verified execution flow steps.
  - `health <id>`: Generates multidimensional health scorecard (0-100).
  - `history <id>`: Displays historical evolution milestones for the feature.

### `projectmind impact`
Evaluates change impact and downstream blast radius for a file or feature.

- **Usage:** `projectmind impact <resource_or_feature> [--depth <n>] [--json]`
- **Arguments:**
  - `<resource_or_feature>`: File path or feature ID.
- **Options:**
  - `--depth <n>`: Traversal depth across dependency edges (default: 5).

### `projectmind history`
Inspects project-wide or feature-specific evolution history.

- **Usage:** `projectmind history [feature <feature_id>] [--recent] [--limit <n>] [--json]`
- **Options:**
  - `--recent`: Restrict output to recent updates.
  - `--limit <n>`: Maximum number of events to show (default: 10).

### `projectmind health`
Displays comprehensive health statuses across platform subsystems.

- **Usage:** `projectmind health [--verbose] [--json]`
- **Subsystems Evaluated:** Kernel, Workspace, Storage, EventBus, Observability, Plugins, Security.

### `projectmind update`
Triggers or monitors the incremental Knowledge Update Loop.

- **Usage:** `projectmind update [--status] [--pending] [--refresh-context] [--json]`
- **Options:**
  - `--status`: Inspects active or recent update runs.
  - `--pending`: Checks for pending uncommitted knowledge observations.
  - `--refresh-context`: Invalidates and refreshes cached context packages.

### `projectmind inspect`
Diagnostic inspection of internal subsystems without mutating state.

- **Usage:** `projectmind inspect <repository|feature|context|agent|knowledge> [target_id] [--json]`

### `projectmind doctor`
Runs diagnostic checks to verify installation, configuration, storage, and security.

- **Usage:** `projectmind doctor [--json]`
- **Checks:**
  - Installation and Node runtime
  - Workspace configuration (`.projectmind/config.json`)
  - Storage connectivity (SQLite WAL)
  - Security secrets configuration
  - Platform integrity

### `projectmind completion`
Generates shell autocompletion scripts for supported shells.

- **Usage:** `projectmind completion <bash|zsh|fish|powershell> [--json]`

### `projectmind version`
Prints version and build information for ProjectMind.

- **Usage:** `projectmind version [--json]`

### `projectmind help`
Displays global help or details for a specific command.

- **Usage:** `projectmind help [command] [--json]`
