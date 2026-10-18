# Retention & Deletion Policies (Phase 8.4)

## Retention Policy (`RetentionPolicy`)

Retention is driven by configuration rules rather than arbitrary database purges:

| Entity Type | Staleness Threshold | Archival Threshold | Deletable Threshold | Immutable |
| :--- | :--- | :--- | :--- | :--- |
| `AUDIT_EVENT` | Never | Never | Never | **YES** |
| `CONTEXT_SESSION` | 24 Hours | 7 Days | 30 Days | No |
| `AGENT_CHECKPOINT` | 48 Hours | 14 Days | 60 Days | No |
| `CACHE_ENTRY` | Immediate | Immediate | Immediate | No |
| `FEATURE` | Policy/Manual | Policy/Manual | Policy/Manual | No |

---

## Deletion Cascades (`DeletionPolicy`)

ProjectMind defines deterministic cascade behaviors between related entities:

| Parent Entity | Child Entity | Action | Rationale |
| :--- | :--- | :--- | :--- |
| `WORKSPACE` | `REPOSITORY` | `RESTRICT` | Fail safe: Cannot delete workspace if repositories exist. |
| `WORKSPACE` | `AUDIT_EVENT` | `DETACH` | Audit records must survive workspace deletion. |
| `REPOSITORY` | `FEATURE` | `SOFT_DELETE` | Features are soft-deleted when repository is deleted. |
| `REPOSITORY` | `KNOWLEDGE_UPDATE` | `ARCHIVE` | Knowledge history is archived rather than dropped. |
| `FEATURE` | `FEATURE_DEPENDENCY` | `DETACH` | Sever dependency relationships without deleting peers. |
| `AGENT_SESSION` | `AGENT_TASK` | `CASCADE` | Child tasks are deleted when session is destroyed. |
| `AGENT_TASK` | `VERIFICATION_RECORD` | `DETACH` | Verification evidence is preserved permanently. |

### Cascade Action Semantics
- `CASCADE`: Deleting parent automatically deletes child records.
- `RESTRICT`: Deletion of parent is rejected if any child record exists.
- `DETACH`: Parent reference is unlinked, but child record is preserved.
- `ARCHIVE`: Child records are transferred to archival storage.
- `SOFT_DELETE`: Child records are flagged as soft-deleted.
