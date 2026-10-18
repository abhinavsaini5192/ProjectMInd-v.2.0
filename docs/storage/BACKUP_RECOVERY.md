# Backup, Restore & Disaster Recovery (Phase 8.4)

## Overview
ProjectMind establishes provider-neutral backup, restore, and recovery abstractions (`IBackupManager`, `IRestoreManager`, `IRecoveryManager`). These interfaces operate without vendor lock-in to specific cloud providers (AWS, GCP, Azure).

---

## Backup Creation & Validation

```typescript
const backup = await backupManager.createBackup({
  scope: { isFull: true },
  description: 'Pre-upgrade snapshot',
  payload: serializedSnapshotData
});
```

### Integrity Verification
Every backup computes a SHA-256 integrity hash over its payload data. Calling `validateBackup(backupId)` re-computes the hash and verifies that the snapshot data has not been tampered with or corrupted on disk:
```typescript
const validation = await backupManager.validateBackup(backup.backupId);
if (!validation.isValid) {
  throw new Error(`Corrupted backup: ${validation.errors.join(', ')}`);
}
```

---

## Controlled Restore Operations

To prevent catastrophic accidental data overwrites in production:

1. **Explicit Operational Authorization**:
   - `authorizedBy` is strictly required. Any restore request missing `authorizedBy` is rejected immediately.
2. **Schema Compatibility Gating**:
   - A backup cannot be restored if `backup.storageVersion > currentStorageVersion` unless explicit `force: true` is provided.
3. **Transactional Execution**:
   - When a `TransactionManager` is available, snapshot data restoration is wrapped inside an atomic transaction. If application of any entity fails, the target database rolls back cleanly.

---

## Recovery Points (`RecoveryPoint`)

Recovery points represent disaster recovery checkpoints:
```typescript
interface RecoveryPoint {
  readonly recoveryPointId: string;
  readonly createdAt: number;
  readonly storageVersion: number;
  readonly applicationVersion: string;
  readonly source: 'MANUAL' | 'SCHEDULED' | 'PRE_MIGRATION' | 'INCIDENT';
  readonly integrityStatus: 'VALID' | 'CORRUPTED' | 'UNVERIFIED';
  readonly scope: BackupScope;
  readonly metadata?: Record<string, unknown>;
}
```
These metadata records allow operators to identify verified restore candidates after incidents or failed deployments.
