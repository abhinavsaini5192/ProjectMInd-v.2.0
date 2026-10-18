# MCP Security Architecture & Protection Guardrails

ProjectMind treats external AI agents as untrusted or limited actors operating across network, IPC, or process boundaries. The MCP layer enforces strict security boundaries.

---

## 1. Threat Mitigation Model

### A. Payload Size Denial of Service (DoS)
- **Constraint**: Incoming payloads and outgoing responses are capped at `maxPayloadBytes` (default: 512 KB).
- **Enforcement**: Serialized byte lengths are measured before processing. If exceeded, the server returns an error with `McpErrorCodes.PAYLOAD_TOO_LARGE` (-32004).

### B. Path Traversal Mitigation
- **Threat**: Malicious client requests attempting relative directory navigation (`../../`) or null-byte poisoning (`\0`) to read arbitrary files outside the repository workspace.
- **Enforcement**: `McpSecurityValidator.validatePathSafety` inspects all path-like and file-like parameters. Any attempt throws `McpErrorCodes.INVALID_PARAMS` (-32602).

### C. Prompt Injection & Context Poisoning
- **Threat**: Untrusted user inputs attempting system override patterns (`"ignore all previous instructions"`, `"system override"`, etc.) embedded in query fields.
- **Enforcement**: `McpSecurityValidator` uses `SecuritySanitizer.checkPromptInjection` to detect prompt injection attempts. Untrusted repository data in results is wrapped in delimited `<repository-data resource="...">...</repository-data>` tags to clearly demarcate untrusted data from system policy.

### D. Credential & Secret Leakage Prevention
- **Threat**: Accidental leakage of AWS access keys, JWT tokens, private keys, database connection strings, or API passwords in responses.
- **Enforcement**: All outgoing MCP results and error strings pass through `SecuritySanitizer.redactSecrets`. Sensitive tokens are replaced with redaction markers (`[REDACTED_AWS_KEY]`, `[REDACTED_JWT_TOKEN]`, `[REDACTED_SECRET]`).

---

## 2. Scope Isolation

Every MCP connection session is bound to a specific `workspaceId` and `repositoryId`:
- Operations targeting resources outside the session's workspace or repository boundaries are immediately aborted with `McpErrorCodes.SCOPE_VIOLATION` (-32003).
- Sessions expire after inactivity (`sessionTimeoutMs`, default 30 minutes). Expired sessions require reconnection.
