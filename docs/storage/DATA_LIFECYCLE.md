# Data Lifecycle Management (Phase 8.4)

## Overview
ProjectMind manages the complete lifecycle of persisted domain entities through explicit, policy-driven transitions. Entities do not remain in an indeterminate state indefinitely.

---

## State Machine

```
┌──────────┐
│  ACTIVE  │
└────┬─────┘
     │ Staleness threshold reached
     ▼
┌──────────┐
│  STALE   │
└────┬─────┘
     │ Archival threshold reached
     ▼
┌────────────┐
│ ARCHIVABLE │ ── archive() ──► [ IArchiveStore ]
└────┬───────┘
     │ Deletable threshold reached
     ▼
┌───────────┐
│ DELETABLE │ ── softDelete() ──► [ Soft Deleted Record ]
└────┬──────┘
     │ Policy-approved physical purge
     ▼
┌─────────┐
│ DELETED │
└─────────┘
```

---

## Operations (`DataLifecycleManager`)

### 1. `evaluate(entity)`
Evaluates the entity against registered retention rules and returns:
- `currentState`
- `recommendedState`
- `reason`
- `matchedRuleName`

### 2. `softDelete(entity, deletedBy, reason)`
Marks the entity as soft-deleted by updating:
- `state = 'DELETED'`
- `isSoftDeleted = true`
- `softDeleteMetadata = { deletedAt, deletedBy, deletionReason, deletionVersion }`
The entity remains visible only to administrative audit queries, while standard application queries omit soft-deleted records.

### 3. `archive(entity)`
Serializes the entity payload into `IArchiveStore`, records its SHA-256 checksum, sets `state = 'ARCHIVED'`, and removes it from the primary hot storage index.

### 4. `restore(entityId, entityType)`
Retrieves the archived payload from `IArchiveStore`, verifies checksum integrity, and returns the entity to `state = 'ACTIVE'`.

### 5. `purge(entity, authorizedBy)`
Verifies that the entity type allows physical deletion (e.g., ephemeral cache entries or temporary bundles). If the entity is an immutable `AUDIT_EVENT`, physical purging throws `StorageCoreError` immediately.
