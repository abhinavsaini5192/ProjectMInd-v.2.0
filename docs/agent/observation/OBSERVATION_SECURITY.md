# Observation Security & Hardening

## 1. Overview

`ObservationSecurityValidator` and `ObservationValidator` enforce strict boundary isolation, payload size constraints, path safety, secret redaction, and telemetry elimination.

---

## 2. Security Controls

### 2.1. Payload Size Bounded Limits
Observations are telemetry and metadata, never binary blobs or log dumps.
- **Max Payload Size**: **64 KB** (`65,536 bytes`).
- Payloads exceeding this threshold are immediately rejected with `ObservationPayloadLimitError` before ingestion.

### 2.2. Strict "No Hidden Reasoning" Policy (Section 41)
In accordance with ProjectMind's privacy and cognitive telemetry boundary rules:
- Internal reasoning, model scratchpads, hidden chains-of-thought, and raw internal token IDs are strictly prohibited from entering the intelligence graph.
- Any object or payload containing keys matching:
  - `chainOfThought`, `chain_of_thought`, `cot`
  - `internalTokens`, `internal_tokens`
  - `hiddenPrompt`, `hidden_prompt`
  - `scratchpad`, `internalReasoning`, `internal_reasoning`
  is either rejected with `ObservationSecurityError` (strict validation mode) or scrubbed completely (sanitization mode).

### 2.3. Path Traversal & Filesystem Safety
Affected resource paths reported by external agents must remain within the workspace repository boundary:
- Traversal patterns (`..`, `../`, `..\`) are strictly forbidden.
- Violations trigger immediate rejection with `ObservationSecurityError` (`PATH_TRAVERSAL_DETECTED`).

### 2.4. Automatic Secret Redaction
All command text strings, summaries, descriptions, and payload values undergo automatic redaction:

| Secret Type | Regex Pattern | Replacement |
| :--- | :--- | :--- |
| **NPM Token** | `npm_[A-Za-z0-9]+` | `[REDACTED_NPM_TOKEN]` |
| **GitHub Token** | `(?:ghp\|gho\|ghu\|ghs\|ghr)_[A-Za-z0-9]+` | `[REDACTED_GITHUB_TOKEN]` |
| **Slack Token** | `xox[baprs]-[A-Za-z0-9-]+` | `[REDACTED_SLACK_TOKEN]` |
| **Anthropic API Key** | `sk-ant-[A-Za-z0-9-_]+` | `[REDACTED_API_KEY]` |
| **Generic sk- Key** | `sk-[A-Za-z0-9]{20,}` | `[REDACTED_API_KEY]` |
| **AWS Access Key** | `(?:A3T...\|AKIA\|ASIA)[A-Z0-9]{16}` | `[REDACTED_AWS_KEY]` |
| **JWT Token** | `eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?...` | `[REDACTED_JWT_TOKEN]` |
| **Private Keys** | `-----BEGIN ... PRIVATE KEY-----` | `[REDACTED_PRIVATE_KEY]` |

### 2.5. Scope & Boundary Isolation
Observations submitted to ProjectMind are scoped to their originating `workspaceId` and `repositoryId`. Any attempt to record or query observations across mismatched workspace boundaries results in an `ObservationScopeError`.
