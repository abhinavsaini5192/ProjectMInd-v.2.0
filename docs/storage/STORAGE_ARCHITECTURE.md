# Storage Architecture (Phase 8.4)

## Architecture Topology

ProjectMind enforces strict decoupling between domain intelligence and persistence infrastructure:

```
┌────────────────────────────────────────────────────────┐
│                   API Controllers                      │  (Phase 8.3)
└──────────────────────────┬─────────────────────────────┘
                           │ Canonical DTOs / Contracts
┌──────────────────────────▼─────────────────────────────┐
│                 Application Services                   │  (Own Domain Semantics & Transactions)
└──────────────────────────┬─────────────────────────────┘
                           │ Domain Entities / Interfaces
┌──────────────────────────▼─────────────────────────────┐
│            Canonical Repositories & Adapters           │  (e.g., IKnowledgeUpdateRepository,
│                                                        │   IVerificationStore, IObservationStore)
└──────────────────────────┬─────────────────────────────┘
                           │ Storage Contracts & UoW
┌──────────────────────────▼─────────────────────────────┐
│                  Storage Subsystems                    │
│   ├── consistency (Transactions, Optimistic Locks)     │
│   ├── migration   (Schema Versions, Safe Startup)      │
│   ├── lifecycle   (Retention, Archival, Deletion)      │
│   ├── recovery    (Backups, Restores, Recovery Points) │
│   └── health      (Liveness, Readiness, Integrity)     │
└──────────────────────────┬─────────────────────────────┘
                           │ Physical Drivers
┌──────────────────────────▼─────────────────────────────┐
│             Storage Providers & Engines                │
│   ├── SQLite Provider (Local / Edge / Test)            │
│   └── Future Distributed Engine (PostgreSQL / Kùzu)    │
└────────────────────────────────────────────────────────┘
```

---

## Architectural Principles

1. **Durability vs. Semantics**:
   - The persistence layer does **not** evaluate risk scores, agent reasoning, feature relevance, or authorization decisions.
   - It guarantees atomic transactions, data versioning, consistent schema migrations, and physical durability.
2. **Provider-Neutral Design**:
   - Domain code depends on abstract interfaces (`ITransactionManager`, `IMigrationManager`, `IBackupManager`).
   - SQLite, filesystem, and future cloud/distributed backends implement these contracts without altering business code.
3. **No Database Access in Controllers**:
   - HTTP controllers only talk to application services. Direct SQL queries, ORM sessions, or database drivers are forbidden in the presentation tier.
4. **Tenant Isolation**:
   - All persistence calls validate workspace ownership (`WorkspaceIsolationRepository`) to reject cross-tenant data leakage.

---

## Subsystem Layout (`src/storage/`)

- `consistency/`: Explicit transaction manager (`TransactionManager`), savepoints, optimistic concurrency (`OptimisticLockManager`), and data integrity validator (`StorageIntegrityValidator`).
- `migration/`: Schema version tracker, ordered migration runner (`StorageMigrationManager`), and startup compatibility gating.
- `lifecycle/`: Retention rules (`RetentionPolicy`), archival storage (`InMemoryArchiveStore`), soft deletion, cascade definitions (`DeletionPolicy`), and lifecycle orchestrator (`DataLifecycleManager`).
- `recovery/`: Snapshot hashing and metadata manager (`StorageBackupManager`), authorized restore manager (`StorageRestoreManager`), and recovery points (`StorageRecoveryManager`).
- `health/`: Storage diagnostics and multi-tier health evaluation (`StorageHealthService`).
- `repositories/`: Hardened implementations of canonical stores (`PersistentAuditStore`, `PersistentKnowledgeUpdateRepository`, `PersistentVerificationStore`, `PersistentObservationStore`, `WorkspaceIsolationRepository`).
- `di/`: Dependency injection tokens (`StorageTokens`) and registration helper (`StorageDISetup`).
