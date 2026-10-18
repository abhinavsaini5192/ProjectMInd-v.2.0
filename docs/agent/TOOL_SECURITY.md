# Tool Safety and Security Boundaries (Phase 7.2)

## 1. Threat Model Overview

The ProjectMind Tool Protocol operates on an **untrusted caller assumption**. AI models, IDE extensions, or network clients may generate hallucinated, manipulated, or adversarial inputs.

```
       Untrusted Agent Input
                 │
                 ▼
     [ ToolRequestValidator ]    Envelope integrity, version enforcement
                 │
                 ▼
      [ ToolSafetyValidator ]    Dangerous key blocking, path traversal, payload limits
                 │
                 ▼
      [ ToolSchemaValidator ]    Type, enum, range, array, recursive depth limits
                 │
                 ▼
   [ AgentCapabilityResolver ]   Strict least-privilege capability boundaries
                 │
                 ▼
       [ Isolated Handler ]      Read-only or report-only delegated execution
                 │
                 ▼
      [ SecuritySanitizer ]      Automatic redaction of secrets, API keys, JWTs
                 │
                 ▼
        Safe ToolResponse
```

---

## 2. Invariant Safety Policies

### 1. No Autonomous Code Execution
- The protocol provides **no execution primitives** (`exec`, `eval`, `spawn`, `fork`, `bash`, `cmd.exe`).
- ProjectMind is an intelligence and context platform, not an arbitrary remote code execution server.

### 2. Strict Safety Levels
Every tool declares an immutable `safetyLevel`:
- `READ_ONLY`: Guarantees zero side effects on repository, configuration, or environment state. Safe to call concurrently.
- `REPORT_ONLY`: Submits non-destructive audit events (task progress, verification diagnostics, discovered insights). Strictly guarded by active session requirements.
- `CONTROLLED_WRITE`: Not permitted in Phase 7.2.

### 3. Path Traversal Mitigation
All string inputs are scanned for path escape patterns:
- `../` and `..\`
- URL-encoded directory escapes (`%2e%2e`)
- Null byte poisoning (`\0`)
Any detected violation immediately aborts execution with `TOOL_ARGUMENT_INVALID`.

### 4. Payload Size Limits
- Payloads are restricted to tool-specific maximum limits (default: 512KB).
- Prevents memory exhaustion, regex DoS, or token stuffing attacks.

### 5. Automated Secret Redaction
All outgoing tool results pass through `SecuritySanitizer.redactSecrets`:
- AWS access keys (`AKIA...`) -> `[REDACTED_AWS_KEY]`
- JWT bearer tokens -> `[REDACTED_JWT_TOKEN]`
- RSA/EC private keys (`-----BEGIN PRIVATE KEY-----`) -> `[REDACTED_PRIVATE_KEY]`
- Passwords and auth tokens -> `[REDACTED_SECRET]`
