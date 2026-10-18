# ProjectMind CLI Configuration

This document explains configuration sources, precedence rules, and environment variables used by the ProjectMind CLI.

## Configuration Precedence

When resolving settings, ProjectMind applies the following strict order of precedence (highest priority first):

```
1. CLI Command-Line Arguments  (--workspace, --json, --verbose, etc.)
               ↓
2. Environment Variables       (PROJECTMIND_*, NODE_ENV)
               ↓
3. Project Configuration       (.projectmind/config.json)
               ↓
4. Global User Configuration   (~/.projectmind/config.json)
               ↓
5. Safe Platform Defaults
```

## Environment Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `PROJECTMIND_WORKSPACE` | String | Current working directory | Root path of the workspace to inspect |
| `PROJECTMIND_ENV` | String | `development` | Platform environment (`development`, `production`, `test`) |
| `PROJECTMIND_SECRET_KEY` | String | `(dev-key)` | Symmetric HMAC key for session tokens and secrets |
| `PROJECTMIND_LOG_LEVEL` | String | `info` | Minimum log level (`debug`, `info`, `warn`, `error`) |
| `PROJECTMIND_TELEMETRY_ENABLED` | Boolean | `true` | Enables or disables command telemetry events |
| `PROJECTMIND_DB_PATH` | String | `(in-workspace)` | Custom database storage path override |

## Project Configuration File

Running `projectmind init` generates `.projectmind/config.json` inside the repository root:

```json
{
  "version": "1.0.0",
  "repository": "MyService",
  "initializedAt": "2026-09-29T22:30:00.000Z",
  "featuresEnabled": true
}
```

### Security Rule on Configuration Files
- Never store API keys, JWT secrets, database passwords, or personal credentials in `.projectmind/config.json`.
- ProjectMind automatically ignores sensitive keys and redacts credentials before serializing any output.
