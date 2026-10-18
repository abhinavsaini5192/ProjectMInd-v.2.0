# Security, Sanitization & Boundary Isolation

## Threat Model & Mitigations

When sending repository context to third-party LLMs, two primary risks exist:
1. **Secret & Credential Leakage**: Hardcoded tokens, API keys, or passwords leaking into prompt text.
2. **Prompt Injection**: Malicious code comments or documentation instructing the LLM to ignore system directives.

## Sanitization Strategy (`ContextIntegrityValidator`)

### 1. Secret Redaction
`ContextIntegrityValidator.sanitizeString()` runs comprehensive regular expressions across all strings, descriptions, and code snippets:
- Targets: `password`, `passwd`, `secret`, `token`, `api_key`, `access_token`, `auth_token`, `bearer`.
- Matches typical assignment patterns: `password = "..."` -> `password="[REDACTED_SECRET]"`.
- Matches authorization headers: `Bearer <token>` -> `Bearer [REDACTED_SECRET]`.

### 2. Boundary Isolation
- Repository code and comments are always treated as untrusted data.
- Claude XML adapter encloses code in `<![CDATA[ ... ]]>` blocks and semantic `<relevant_resources>` tags.
- Markdown adapters clearly demarcate context blocks with `--- BEGIN CONTEXT PACKAGE ---` and `--- END CONTEXT PACKAGE ---`.

### 3. Graph Integrity & Cycle Detection
- Circular dependencies in feature graphs (e.g. $A \to B \to C \to A$) can cause infinite recursion.
- `ContextIntegrityValidator.validateGraphIntegrity()` runs depth-first cycle detection and emits a `CIRCULAR_DEPENDENCY` warning without crashing the orchestrator.
