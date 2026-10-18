# ProjectMind — Persistence & Data Lifecycle (Phase 8.4)

## Overview
Phase 8.4 establishes a hardened, production-grade persistence and data lifecycle foundation for ProjectMind. It adheres strictly to the core principle:

> **Persistence is infrastructure. Domain services own meaning. Persistence owns durability.**

The persistence architecture does not replace existing domain storage abstractions or create duplicate repository layers. Instead, it hardens:
- Explicit transaction boundaries and savepoint rollback semantics
- Optimistic concurrency control and version conflict management
- Versioned, ordered schema migrations with SHA-256 tamper detection and startup compatibility gating
- Comprehensive data integrity validation (workspace/repo scope, orphan references, foreign keys)
- Policy-driven data lifecycle management (active, stale, archivable, deletable, deleted)
- Soft deletion with auditable provenance and strictly defined relationship cascade behaviors
- Provider-neutral backup, restore, and disaster recovery points
- Storage health monitoring separating **liveness**, **readiness**, and **data integrity**
- Tenant isolation ensuring workspace and repository boundaries are enforced across all reads and writes

---

## Documentation Index

| Document | Purpose |
| :--- | :--- |
| [STORAGE_ARCHITECTURE.md](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/docs/storage/STORAGE_ARCHITECTURE.md) | High-level storage topology, provider interfaces, layering, and DI tokens |
| [TRANSACTIONS.md](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/docs/storage/TRANSACTIONS.md) | Explicit transaction boundaries, nested savepoints, timeouts, and failure rollback |
| [CONCURRENCY.md](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/docs/storage/CONCURRENCY.md) | Optimistic locking, version tracking, conflict detection, and retry backoff |
| [MIGRATIONS.md](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/docs/storage/MIGRATIONS.md) | Schema migration planning, execution, checksum verification, and safe startup gating |
| [DATA_INTEGRITY.md](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/docs/storage/DATA_INTEGRITY.md) | Scope validation, orphan detection, reference consistency, and structured diagnostics |
| [DATA_LIFECYCLE.md](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/docs/storage/DATA_LIFECYCLE.md) | State machine (ACTIVE → STALE → ARCHIVABLE → ARCHIVED → DELETABLE → DELETED) |
| [RETENTION.md](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/docs/storage/RETENTION.md) | Policy-driven retention rules, immutable audit protection, and age thresholds |
| [BACKUP_RECOVERY.md](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/docs/storage/BACKUP_RECOVERY.md) | Provider-neutral backup creation, integrity validation, authorized restore, and recovery points |
| [STORAGE_SECURITY.md](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/docs/storage/STORAGE_SECURITY.md) | Workspace and repository tenant isolation, secret scrubbing, and audit immutability |

---

## Key Interfaces & Symbols

- `ITransactionManager` / `StorageTokens.TransactionManager`
- `IConcurrencyManager` / `StorageTokens.ConcurrencyManager`
- `IStorageIntegrityValidator` / `StorageTokens.IntegrityValidator`
- `IMigrationManager` / `StorageTokens.MigrationManager`
- `IDataLifecycleManager` / `StorageTokens.DataLifecycleManager`
- `IBackupManager` / `StorageTokens.BackupManager`
- `IRestoreManager` / `StorageTokens.RestoreManager`
- `IRecoveryManager` / `StorageTokens.RecoveryManager`
- `IStorageHealthService` / `StorageTokens.StorageHealthService`
