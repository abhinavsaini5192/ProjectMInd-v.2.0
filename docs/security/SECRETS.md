# ProjectMind Secret Management & Pre-Log Redaction (Phase 8.9)

## 1. Zero Plaintext Secrets Policy

ProjectMind operates under a strict zero-plaintext-secrets mandate:
- No hardcoded API keys, tokens, passwords, or certificates are stored in source code.
- Configuration relies on environment variables or vault references (`vault://secrets/name`).
- All discovered tokens must be rotated immediately upon detection.

## 2. Secret Detection & Redaction

The platform embeds `SecretScanner`, executing pre-log, pre-telemetry, and pre-response pattern sanitization:
- **OpenAI Keys**: `sk-[A-Za-z0-9-_]{20,}` -> `[REDACTED_OPENAI_KEY]`
- **GitHub Tokens**: `gh[pousr]_[A-Za-z0-9_]{36,}` -> `[REDACTED_GITHUB_TOKEN]`
- **AWS Access Keys**: `AKIA[0-9A-Z]{16}` -> `[REDACTED_AWS_ACCESS_KEY]`
- **Private Keys**: `-----BEGIN [A-Z ]*PRIVATE KEY-----` -> `[REDACTED_PRIVATE_KEY]`
- **Database URLs**: `postgres://user:pass@host` -> `[REDACTED_DB_CONNECTION_CREDENTIALS]`
- **Bearer Tokens**: `Bearer eyJ...` -> `[REDACTED_BEARER_TOKEN]`

## 3. Object-Level Sanitization

`SecretScanner.redactObject` recursively traverses payloads and configuration objects, replacing fields named `password`, `secret`, `token`, `apikey`, or `privatekey` with `[REDACTED_CREDENTIAL]`.
