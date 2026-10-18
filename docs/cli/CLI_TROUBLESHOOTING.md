# ProjectMind CLI Troubleshooting & Exit Codes

This guide covers exit codes, error diagnostics, and common issues encountered when using the ProjectMind CLI.

## Standard Exit Codes

The CLI emits standardized, deterministic exit codes to simplify automation and scripting:

| Code | Constant | Meaning | Common Remediation |
|------|----------|---------|--------------------|
| `0` | `SUCCESS` | Command completed successfully | None |
| `1` | `GENERAL_FAILURE` | General execution error | Check error message and logs |
| `2` | `INVALID_USAGE` | Missing argument, unknown command, or invalid option | Run `projectmind help <command>` |
| `3` | `CONFIG_FAILURE` | Configuration file is corrupt or environment variable missing | Check `.projectmind/config.json` |
| `4` | `AUTH_FAILURE` | Missing or invalid authentication credentials | Verify `PROJECTMIND_SECRET_KEY` |
| `5` | `FORBIDDEN_SCOPE` | Unauthorized access to specified repository or workspace | Verify current role permissions |
| `6` | `RESOURCE_NOT_FOUND` | Target file, feature, or resource does not exist | Verify resource path or feature ID |
| `7` | `SERVICE_UNAVAILABLE` | Database connection or background worker offline | Verify SQLite permissions or restart daemon |
| `8` | `STALE_CONFLICT` | Cached context or knowledge graph is out of sync | Run `projectmind update` |
| `9` | `VERIFICATION_FAILURE` | Diagnostic or verification rule check failed | Review `projectmind doctor` output |
| `10` | `INTERNAL_ERROR` | Unhandled platform exception | Run with `--debug` and report bug |

## Diagnosing Issues with `projectmind doctor`

When experiencing problems with ProjectMind, always begin by running `doctor`:

```bash
projectmind doctor
```

The doctor command inspects:
- Node.js runtime compatibility
- Workspace configuration validity
- SQLite database read/write permissions
- Secret key presence in production environments

## Enabling Debug Mode

By default, ProjectMind suppresses raw stack traces to prevent credential leakage and keep output readable. To view full diagnostic traces for an unexpected failure:

```bash
projectmind status --debug
```

In `--json` mode, error diagnostics and stack traces are attached safely under `metadata.stack` after sensitive keys have been redacted.
