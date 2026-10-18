# Phase 8.2 Secret Management & Redaction

## 1. Secrets Handling Principles

1. **Never Store Plaintext Secrets**: Sensitive credentials (passwords, private keys, API tokens) must never be saved in audit logs, task states, or telemetry.
2. **Automated Redaction**: Input payloads and diagnostic outputs are scrubbed recursively before persistence or transmission.
3. **Reference-Based Credential Storage**: Secrets are stored externally or securely hashed; the platform tracks `CredentialReference` records rather than raw secrets.

---

## 2. Redaction Architecture

ProjectMind employs two coordinated redaction engines:
- `LogRedactor` (from Phase 8.1): Sanitizes structured log fields and output strings.
- `ConfigRedactor` (from Phase 8.1): Masks connection strings and environment configurations.

### Sensitive Key Patterns
Any key matching these case-insensitive substrings is automatically replaced with `[REDACTED]`:
- `password`, `passwd`, `pwd`
- `secret`, `secretkey`
- `token`, `bearer`, `auth`
- `apikey`, `api_key`
- `privatekey`, `cert`

### Connection String Scrubbing
URIs with embedded credentials:
```
postgres://user:super_secret_pw@db.internal:5432/main
```
are converted to:
```
postgres://user:[REDACTED]@db.internal:5432/main
```

---

## 3. Tool Parameter Sanitization

The `ToolSecurityAuthorizer.sanitizeToolParameters` method deep-clones incoming arguments and scrubs any matching keys before passing parameters to tool handlers or audit loggers.
