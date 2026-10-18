# ProjectMind Cryptographic Audit Logging & Tamper Resistance (Phase 10.8)

## 1. Audit Principles

Audit records provide non-repudiation and forensic visibility across all security-sensitive operations.
- **Append-Only**: Audit logs cannot be modified, edited, or retroactively truncated by any user or administrator API.
- **Cryptographic Tamper-Evidence**: Each audit entry is cryptographically linked to the previous entry via SHA-256 hash chaining. Modifying, deleting, or re-ordering any event breaks the hash chain immediately.
- **Structured Fields**:
  - `eventId`: Unique identifier (`audit_<timestamp>_<sequence>`)
  - `sequenceNumber`: Monotonically increasing 1-based integer
  - `previousHash`: SHA-256 hash of the preceding audit record (genesis hash: 64 zeros)
  - `hash`: SHA-256 hash computed over the canonical event payload
  - `eventType`: Audit event type (`AUTHENTICATION_SUCCESS`, `AUTHENTICATION_FAILURE`, `AUTHORIZATION_ALLOW`, `AUTHORIZATION_DENIAL`, `JOB_CANCELLED`, `BACKUP_CREATED`, `BACKUP_RESTORED`, `CONFIG_CHANGED`, etc.)
  - `principalId`: Actor responsible for the operation
  - `workspaceId` / `repositoryId`: Scope of target resource
  - `action`: Specific permission action
  - `result`: `SUCCESS` | `FAILURE` | `ALLOWED` | `DENIED`
  - `timestamp`: ISO-8601 UTC string
  - `correlationId`: Distributed trace correlation ID
  - `details`: Structured metadata (sanitized pre-storage via `LogRedactor`)

---

## 2. Cryptographic Hash Chaining

The hash of audit event $N$ is computed as:
$$\text{hash}_N = \text{SHA-256}(\text{JSON}(\text{sequenceNumber}_N, \text{eventId}_N, \text{timestamp}_N, \text{eventType}_N, \text{principalId}_N, \text{workspaceId}_N, \text{repositoryId}_N, \text{result}_N, \text{reason}_N, \text{previousHash}_N))$$

Where $\text{previousHash}_N = \text{hash}_{N-1}$.

---

## 3. Automated Integrity Probing

The `AuditLogger.verifyIntegrity()` method validates:
1. **Sequence Continuity**: Every event satisfies $\text{sequenceNumber}_i = i + 1$. Sequence gaps indicate deleted records.
2. **Chain Continuity**: Every event satisfies $\text{previousHash}_i = \text{hash}_{i-1}$.
3. **Payload Integrity**: Every event satisfies $\text{hash}_i = \text{recomputedHash}(\text{event}_i)$.
4. **Report Output**: Pinpoints the exact `brokenAtEventId`, `brokenSequenceNumber`, and reason upon detection of tampering.

---

## 4. Security Events Catalog

The platform publishes canonical security events via the internal EventBus:
- `security.authentication.succeeded`
- `security.authentication.failed`
- `security.authorization.denied`
- `security.scope.violation`
- `security.credential.revoked`
- `security.identity.created`
- `security.identity.disabled`
- `security.role.changed`
- `security.permission.changed`
- `security.policy.violation`
- `security.secret.detected`
- `security.provenance.invalid`
- `security.configuration.error`
- `security.access.suspicious`
- `security.recovery.authorization.failed`
- `security.violation.detected`
