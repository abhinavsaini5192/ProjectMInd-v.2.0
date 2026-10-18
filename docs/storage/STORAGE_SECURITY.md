# Storage Security & Isolation (Phase 8.4)

## Overview
Persistence in ProjectMind preserves all tenant security and identity boundaries established in Phase 8.2. Persistence code actively rejects accidental cross-scope operations and protects audit records from tampering or data loss.

---

## Tenant Isolation (`WorkspaceIsolationRepository`)

1. **Workspace Boundary**:
   - Entities belonging to `Workspace A` are invisible to `Workspace B`.
   - Persistence layers validate `entity.workspaceId === contextWorkspaceId` on every read and write.
   - Cross-workspace write attempts throw a `StorageCoreError` security violation.
2. **Repository Binding**:
   - Repositories are bound to exactly one workspace (`registerRepositoryScope`).
   - Reassigning a repository to another workspace without authorized domain migration is blocked.

---

## Secret Scrubbing

Persistence layers **never** store plaintext credentials, API keys, private tokens, or passwords.
- `LogRedactor` / regex scrubbing scrubs sensitive keys (`password`, `secret`, `token`, `apiKey`) before persistence in audit logs or diagnostics.
- Secret references (`CredentialReference`) are stored instead of raw credential values.

---

## Audit Record Immutability (`PersistentAuditStore`)

Security audit logs represent tamper-evident legal records:
1. **SHA-256 Hash Chain**:
   - Each audit event includes the SHA-256 hash of the preceding event (`previousChecksum`), creating an immutable cryptographic chain.
   - Calling `verifyIntegrity()` verifies both per-record checksums and the uninterrupted chain across history.
2. **Deletion Refusal**:
   - Calling `deleteEvent()` throws `StorageCoreError`.
   - General cleanup, retention expiration, and workspace purge routines cannot delete audit events (`AUDIT_EVENT` onParentDelete: `DETACH`, deletion forbidden).
