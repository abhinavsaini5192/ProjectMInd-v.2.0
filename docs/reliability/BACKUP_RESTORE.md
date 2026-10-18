# ProjectMind Backup & Restore Validation

In ProjectMind, a backup is never assumed usable merely because an archive file exists. All backups and restore requests undergo strict pre-execution validation through `BackupRestoreValidator`.

## 1. Backup Artifact Validation

Before an artifact is indexed as an eligible recovery point, `BackupRestoreValidator.validateBackup` verifies:
1. **Metadata Existence**: Presence of `backupId`, `createdAt`, `storageVersion`, and `applicationVersion`.
2. **Timestamp Sanity**: Creation time must be non-zero and not in the future (> 60s skew rejected).
3. **Status Check**: Status must be strictly `COMPLETED`. In-progress or failed backups are rejected.
4. **Integrity Hash**: Non-empty cryptographic checksum (`integrityHash`) computed across the payload.

## 2. Restore Safety Assessment

When an operator issues a restore command, `BackupRestoreValidator.validateRestore` validates:
1. **Operator Authorization**: Rejects restore if `authorizedBy` is empty or unauthenticated.
2. **Target Schema Compatibility**:
   - If `backup.storageVersion > currentStorageVersion`: **REJECTED**. The backup was created with a newer database schema than the running binary supports.
   - If `backup.storageVersion < currentStorageVersion`: Allowed with warning (requires schema migration step after restoration unless `--force` is specified).
3. **Scope Enforcement**: Scoped restores (e.g. restoring a specific workspace or repository) must specify valid `targetWorkspaceId`.

## 3. Post-Restore Recovery Verification

Restore is not considered successful until `RecoveryVerifier` confirms:
1. `storage_accessibility`: Datastore reads and writes work.
2. `schema_compatibility`: Tables and migrations match current application code.
3. `storage_integrity`: Foreign keys and relational constraints are valid.
4. `security_boundaries`: Workspace isolation and authorization scopes remain intact.
5. `job_subsystem`: Job queues and worker pools are reachable and capable of processing tasks.
6. `event_bus`: Pub/sub channels accept and deliver events.
7. `knowledge_consistency`: Repository knowledge state is queryable and non-corrupt.
