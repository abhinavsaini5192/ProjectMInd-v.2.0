# Concurrency Security & Tenant Isolation

## 1. Threat Model & Mitigations

Concurrency primitives can introduce subtle security vulnerabilities if not guarded by strict tenant boundaries and ownership controls:

| Threat Vector | Description | Mitigation in Phase 8.7 |
| :--- | :--- | :--- |
| **Cross-Workspace Lock Theft** | Tenant A attempts to lock or block Tenant B's repository. | Lock keys enforce `ws:${workspaceId}` prefix. Scopes are validated before acquisition. |
| **Lock Hijacking / Snooping** | Malicious agent releases another agent's active lock. | `release()` and `renew()` validate `ownerId` cryptographically. Unauthorized attempts are rejected. |
| **Cache Cross-Contamination** | Tenant A accesses cached context generated for Tenant B. | Coalescing and cache keys partition by `workspaceId`, `principalId`, and `securityScopes`. |
| **Resource Starvation (DoS)** | Rogue workspace spawns 1,000 parallel workers to starve others. | `WorkloadLimiter` enforces strict per-workspace concurrency caps (default 10). |
| **Stale Privilege Escalation** | Revoked user role reused from cached context. | Context cache keys incorporate the actor's security scopes; version increments invalidate old context. |

---

## 2. Scope Validation Rules

1. **Workspace Boundary**:
   Every lock acquisition and lease creation must provide a valid `workspaceId`. Attempting to access or lock outside the caller's authorized workspace triggers a `SCOPE_CONFLICT` which is strictly non-retryable.
2. **Owner Identity Verification**:
   The `ownerId` must represent an authenticated agent ID, worker ID, or system instance ID. Arbitrary client-provided owner IDs are rejected.
3. **Auditability**:
   All lock acquisitions, contentions, and expirations are logged with standard correlation IDs and distributed trace IDs.
