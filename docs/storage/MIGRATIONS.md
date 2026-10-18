# Schema Migrations & Startup Safety (Phase 8.4)

## Overview
ProjectMind manages schema evolution using ordered, deterministic, and auditable migrations. To prevent data loss and corrupted state, the application will **never** silently boot against an incompatible or partially-migrated database.

---

## Migration States

| Status | Meaning |
| :--- | :--- |
| `PENDING` | Migration registered and queued for future execution. |
| `RUNNING` | Migration actively executing inside an atomic transaction. |
| `APPLIED` | Migration completed successfully; version recorded in storage history. |
| `FAILED` | Migration threw an error during execution; recorded for operator inspection. |
| `ROLLED_BACK` | Migration down() action was executed; reverted to prior version. |

---

## Startup Compatibility Gating

During application bootstrap (`PlatformBootstrap`), `StorageMigrationManager.validateStartupCompatibility(requiredVersion)` is called:

```
App Schema Requirement vs. Storage Current Version
                        │
      ┌─────────────────┼──────────────────┐
      ▼                 ▼                  ▼
Current < Required  Current === Required  Current > Required
      │                 │                  │
MIGRATION_REQUIRED  COMPATIBLE     STORAGE_AHEAD_OF_APP
 (Block Startup)     (Allow Boot)      (Block Startup)
```

- **MIGRATION_REQUIRED**: Storage is behind the application binary. Automated migrations must be run before serving traffic.
- **STORAGE_AHEAD_OF_APP**: Storage is newer than the binary (e.g. rolled-back binary deployment). Startup is blocked to prevent running outdated code against new schema structures.
- **CORRUPTED**: Any migration is in `FAILED` status. The system refuses to boot until an operator resolves the failed migration.

---

## Safety Guarantees

1. **SHA-256 Checksum Tamper Detection**:
   - When a migration is registered, its checksum is validated against the recorded history.
   - If an applied migration script's contents are altered after the fact, the runner halts immediately.
2. **Deterministic Ordering**:
   - Migrations are sorted by strictly increasing integer versions (`1`, `2`, `3`).
   - Prerequisites declared in `dependencies` must be applied prior to dependent migrations.
3. **No Automatic Database Drops**:
   - Destructive migrations (`isDestructive: true`) are rejected in production unless `allowDestructive: true` is explicitly passed by an authorized operator.
