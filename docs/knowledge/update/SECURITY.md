# Knowledge Update Security & Isolation Bounds

## Multi-Tenant Scope Validation

ProjectMind enforces strict workspace and repository isolation:

1. **Mandatory Repository Scope**: All updates must specify a non-empty `repositoryId`. Cross-repository mutations without explicit scope parameters throw `KnowledgeUpdateScopeError`.
2. **Workspace Containment**: If `workspaceId` is supplied, all feature and resource references are verified to reside within that workspace envelope.

## Path Traversal & Escaping Protection

`KnowledgeUpdateValidator` inspects all resource paths before normalization and planning:

- **Directory Traversal**: Paths containing `..` or null bytes (`\0`) are immediately rejected.
- **Root/System Escaping**: Absolute system paths (e.g. `/etc/passwd`, `C:\Windows\...`, `/var/run/...`) outside the repository boundary throw `InvalidKnowledgeUpdateError`.
- **Posix Canonicalization**: Forward-slash canonicalization ensures consistency across operating systems.

## Anti-Forging Provenance Guards

- External agents or manual callers attempting to submit `provenance: 'SYSTEM_VERIFIED'` are blocked. Only internal trusted adapters (e.g. `VerificationEvidenceAdapter` handling cryptographically verified or CI-derived records) can set `SYSTEM_VERIFIED`.

## Secret Redaction & Sanitization

Incoming metadata and payload properties are scanned for sensitive credential patterns:

```typescript
const SECRET_PATTERNS = [
  /ghp_[A-Za-z0-9_]{36,}/g, // GitHub Personal Access Tokens
  /npm_[A-Za-z0-9_]{36,}/g, // NPM access tokens
  /sk-ant-[A-Za-z0-9\-_]{20,}/g, // Anthropic API keys
  /sk-[A-Za-z0-9]{20,}/g, // OpenAI API keys
  /xoxb-[A-Za-z0-9\-]+/g, // Slack bot tokens
  /AKIA[0-9A-Z]{16}/g, // AWS Access Keys
  /bearer\s+[A-Za-z0-9\-_\.=]{20,}/gi, // Bearer tokens
  /(api[_-]?key|secret|password)\s*[:=]\s*['"][^'"]{8,}['"]/gi // Generic key-value secrets
];
```

Any matched secret values are masked with `[REDACTED_SECRET]` before storage in the update repository or logging in event traces.
