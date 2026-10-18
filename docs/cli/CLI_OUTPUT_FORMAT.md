# ProjectMind CLI Output Format & Contracts

The ProjectMind CLI adheres to a deterministic output contract across all commands to ensure reliability for human engineers, shell scripts, and AI agents.

## Supported Output Formats

1. **Text Mode (`--text` or default in interactive terminals):**
   - Clean, human-readable layout with ANSI status symbols (`✓`, `✗`, `⚠`).
   - Tables and indented key-value trees for structured payloads.
   - Suppresses internal technical jargon unless `--verbose` is provided.

2. **JSON Mode (`--json`):**
   - Strictly formatted JSON printed directly to stdout on success, or stderr on error.
   - Guaranteed machine-readable envelope conforming to `CLIResult`.
   - Ideal for agent tool use, CI pipelines, and scripting.

3. **Table Mode (`--table`):**
   - Formats lists and tabular data as ASCII tables.

## The Canonical `CLIResult` Envelope

All commands executed by `CLIApplication` return the standard `CLIResult` structure:

```typescript
export interface CLIResult<T = unknown> {
  readonly success: boolean;
  readonly command: string;
  readonly exitCode: CLIExitCode;
  readonly message?: string;
  readonly data?: T;
  readonly warnings?: readonly string[];
  readonly errors?: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}
```

### Success Response Example (`projectmind status --json`)

```json
{
  "success": true,
  "command": "status",
  "exitCode": 0,
  "message": "ProjectMind status for 'ProjectMind': HEALTHY",
  "data": {
    "project": "ProjectMind",
    "workspace": "/workspace/ProjectMind",
    "environment": "development",
    "version": "1.0.0",
    "health": "HEALTHY",
    "uptimeSeconds": 142.5,
    "knowledgeVersion": "v1.0.0",
    "snapshotsCount": 2,
    "activePlugins": 3,
    "lastUpdated": "2026-09-29T22:30:00.000Z"
  },
  "metadata": {
    "durationMs": 14
  }
}
```

### Error Response Example (`projectmind context --json`)

```json
{
  "success": false,
  "command": "context",
  "exitCode": 2,
  "message": "Please provide a task description or target feature ID (e.g. projectmind context \"fix payment timeout\")",
  "errors": [
    "Please provide a task description or target feature ID (e.g. projectmind context \"fix payment timeout\")"
  ],
  "metadata": {
    "durationMs": 3
  }
}
```

## Automated Secret Redaction

Every output string and JSON payload is filtered through `LogRedactor` and `ConfigRedactor` before being printed to stdout or stderr.

The redactor automatically masks:
- Bearer tokens (`Bearer [REDACTED]`)
- JWT strings (`eyJ...` -> `[REDACTED]`)
- Connection strings with passwords (`postgres://user:pass@host` -> `postgres://user:[REDACTED]@host`)
- Object keys matching sensitive patterns (`password`, `secret`, `token`, `apiKey`, `credential`)
