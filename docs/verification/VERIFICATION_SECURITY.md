# Verification Security & Boundary Enforcement

## Overview

The ProjectMind Verification Integration system implements strict security controls and boundary enforcement to prevent untrusted AI agents or compromised external sources from tampering with repository intelligence, forging trusted assertions, injecting sensitive credentials, or escaping repository containment.

Because ProjectMind serves as the canonical source of repository truth, verification evidence submitted by untrusted agents must be treated with zero-trust principles.

---

## 1. Zero-Trust Provenance & Anti-Forging

### The Impersonation Threat
An AI agent completing a task might attempt to report:
```json
{
  "systemVerified": true,
  "trustLevel": "AUTHORITATIVE",
  "verificationLevel": "SYSTEM_VERIFIED"
}
```
If accepted naively, the agent could claim that an independent CI/CD pipeline or compiler verified its changes when in fact no independent check occurred.

### Enforcement Policy
`VerificationSecurityValidator.assertNoForgedProvenance()` evaluates all incoming verification requests:
1. **Agent Origin Check**: When a submission originates from an `AGENT` source:
   - `systemVerified` MUST NOT be set to `true`.
   - `trustLevel` MUST NOT be set to `TRUSTED` or `AUTHORITATIVE`.
   - `verificationLevel` MUST NOT be set to `SYSTEM_VERIFIED`.
2. **Violation Handling**:
   - Any attempt by an agent to claim system-verified status immediately throws `VerificationTrustError`.
   - The submission is rejected before reaching the store, and an audit alert is triggered.
3. **Legitimate System Verification**:
   - Only registered, authenticated sources (e.g. GitHub Actions webhook, Jenkins plugin, direct CI runner token) registered with the `IVerificationSourceTrustRegistry` can produce `SYSTEM_VERIFIED` or `AUTHORITATIVE` records.

---

## 2. Secret Redaction & Credential Filtering

### Redaction Rules
Verification payloads often contain console logs, stack traces, environment variable dumps, or runner outputs. These outputs frequently leak API credentials, private tokens, or connection strings.

`VerificationSecurityValidator.sanitizeRawOutput()` scans all freeform string fields and output streams against known credential patterns:

| Credential Type | Regex Pattern / Token Signature | Masking Format |
|-----------------|---------------------------------|----------------|
| GitHub Tokens | `ghp_[A-Za-z0-9_]{36,}` | `[REDACTED_SECRET]` |
| NPM Auth Tokens | `npm_[A-Za-z0-9_]{36,}` | `[REDACTED_SECRET]` |
| Anthropic API Keys | `sk-ant-[A-Za-z0-9\-_]{20,}` | `[REDACTED_SECRET]` |
| OpenAI API Keys | `sk-[A-Za-z0-9]{20,}` | `[REDACTED_SECRET]` |
| Slack Bot Tokens | `xoxb-[A-Za-z0-9\-]+` | `[REDACTED_SECRET]` |
| AWS Access Keys | `AKIA[0-9A-Z]{16}` | `[REDACTED_SECRET]` |
| Bearer Tokens | `(?i)bearer\s+[A-Za-z0-9\-_\.=]{20,}` | `Bearer [REDACTED_SECRET]` |
| Generic API Keys / Passwords | `(?i)(api[_-]?key\|secret\|password)\s*[:=]\s*['"][^'"]{8,}['"]` | `$1=[REDACTED_SECRET]` |

### Sanitization Timing
Sanitization occurs in `VerificationSecurityValidator` prior to persistence in `IVerificationStore` and prior to event broadcasting. Unsanitized credentials never reach event subscribers or disk storage.

---

## 3. Payload Bounds & DoS Protection

Unbounded verification outputs can cause memory exhaustion, database degradation, and context-window pollution for downstream LLM reasoning.

### Strict Limits
- **Max Raw Output Size**: 64 KB (65,536 characters).
  - Outputs exceeding this size are deterministically truncated with an indicator: `\n... [TRUNCATED: Verification output exceeded 65536 bytes] ...`.
- **Max Error Details / Stack Traces**: 16 KB per failure item.
- **Max Path Length**: 1,024 characters.
- **Max Array Lengths**: 500 test cases, 500 lint issues, 200 security findings per single verification record. Exceeding items are summarized in aggregate metrics.

---

## 4. Path Traversal & File System Containment

### Attack Vector
A malicious or confused agent might submit verification scopes containing relative escape sequences:
```json
{
  "files": [
    "../../etc/passwd",
    "..\\..\\Windows\\System32\\config\\SAM",
    "/absolute/system/path/outside/repo"
  ]
}
```

### Normalization and Enforcement
`VerificationSecurityValidator.validateScopeContainment()` validates all file and directory paths:
1. **Path Traversal Rejection**: Any path containing `..` or null bytes (`\0`) is immediately rejected with `VerificationPathSecurityError`.
2. **Repository Confinement**: All paths must be relative to the repository root. Absolute system paths (e.g. `C:\Windows`, `/etc/`) are strictly disallowed.
3. **Canonical Normalization**: Backward slashes (`\`) are normalized to POSIX forward slashes (`/`) for cross-platform consistency.

---

## 5. Tenant & Workspace Boundary Enforcement

ProjectMind is multi-tenant and multi-workspace aware:
- Every `VerificationRecord` requires an immutable `repositoryId` and optional `workspaceId`.
- Queries executing through `IVerificationQueryService` or canonical tool handlers MUST filter strictly by the calling session's `repositoryId`.
- Cross-tenant record leakage is prevented at the query routing layer. Verification records cannot be queried or updated across repository boundaries.

---

## 6. No-Hidden-Reasoning Policy

ProjectMind enforces complete transparency in verification records:
- **No Hidden Thoughts / Chain-of-Thought Scratchpads**: Verification records must only contain factual execution metadata (tool name, exit code, test count, failures, timestamps, commit SHA).
- **Auditability**: Every record links to its submitter identity (`agentId`, `toolCallId`, or `sourceId`), preventing anonymous claims.
- **Tamper Evidence**: Verification records in `IVerificationStore` are immutable. Once written, a record's `evidenceId`, `commitSha`, and `provenance` cannot be altered. New verification replaces previous records through versioned timelines rather than in-place overwrites.
