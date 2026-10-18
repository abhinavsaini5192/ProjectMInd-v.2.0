# Environment Configuration Reference

## 1. Overview

ProjectMind uses a unified configuration engine powered by Zod (`PlatformConfigSchema`). All parameters can be configured via environment variables, configuration JSON files, or constructor overrides.

## 2. Environment Variables Reference

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `PROJECTMIND_ENV` | `string` | `development` | Environment mode: `development`, `test`, `production` |
| `PROJECTMIND_APP_NAME` | `string` | `projectmind` | Identifier for the running service instance |
| `PROJECTMIND_APP_VERSION` | `string` | `1.0.0` | Release version tag |
| `PROJECTMIND_LOG_LEVEL` | `string` | `INFO` | Minimum severity: `DEBUG`, `INFO`, `WARN`, `ERROR`, `FATAL` |
| `PROJECTMIND_RUNTIME_ENABLED` | `boolean` | `true` | Enables the closed-loop agent runtime |
| `PROJECTMIND_MAX_SESSIONS` | `number` | `10` | Maximum concurrent active agent sessions |
| `PROJECTMIND_MAX_TASKS` | `number` | `20` | Maximum concurrent active agent tasks |
| `PROJECTMIND_SESSION_TIMEOUT_MS` | `number` | `3600000` | Inactivity TTL before session expiration (1h) |
| `PROJECTMIND_TASK_TIMEOUT_MS` | `number` | `1800000` | Task execution timeout before automatic failure (30m) |
| `PROJECTMIND_TOOL_TIMEOUT_MS` | `number` | `30000` | Tool execution deadline (30s) |
| `PROJECTMIND_SHUTDOWN_TIMEOUT_MS` | `number` | `15000` | Maximum drain timeout during graceful shutdown (15s) |
| `PROJECTMIND_CONTEXT_REFRESH_POLICY` | `string` | `ON_NEXT_REQUEST` | Refresh policy: `IMMEDIATE`, `ON_NEXT_REQUEST`, `LAZY`, `MANUAL` |
| `PROJECTMIND_STORAGE_TYPE` | `string` | `memory` | Backend: `memory`, `sqlite`, `filesystem` |
| `PROJECTMIND_STORAGE_LOCATION` | `string` | `.projectmind/data` | Directory for persistent storage |
| `PROJECTMIND_DATABASE_URL` | `string` | `undefined` | Optional connection string (e.g. SQLite/Postgres) |
| `PROJECTMIND_MAX_PAYLOAD_BYTES` | `number` | `10485760` | Maximum inbound request payload size (10 MB) |
| `PROJECTMIND_CACHE_ENABLED` | `boolean` | `true` | Enable caching subsystem |
| `PROJECTMIND_CACHE_TYPE` | `string` | `memory` | Cache backend: `memory`, `sqlite`, `redis` |
| `PROJECTMIND_LOG_FORMAT` | `string` | `json` | Log output format: `json` or `pretty` |
| `PROJECTMIND_SECRET_REDACTION_ENABLED` | `boolean` | `true` | Automatically redact tokens and credentials |
| `PROJECTMIND_ALLOW_UNSAFE_DEV_DEFAULTS` | `boolean` | `false` | Must remain `false` in production environments |

## 3. Strict Production Validations

When `PROJECTMIND_ENV=production`:
- `allowUnsafeDevDefaults` must be `false`.
- If `storage.type === 'sqlite'`, `location` cannot be `:memory:`.
- Any missing required configuration immediately aborts startup with `PlatformConfigurationError`.
