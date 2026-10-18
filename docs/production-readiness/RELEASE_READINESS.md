# ProjectMind Release & Rollback Readiness

## 1. Production Release Metadata

The canonical release metadata is tracked in `src/production/models/ReleaseMetadata.ts`:

```typescript
export const CanonicalReleaseMetadata: ReleaseMetadata = {
  version: '1.0.0',
  buildId: 'pm-prod-20260929-v1',
  gitCommit: 'f8c47e19a42d',
  gitBranch: 'main',
  schemaVersion: '2.0.0',
  apiVersion: 'v1',
  runtimeVersion: '1.0.0',
  compatibility: {
    minNodeVersion: '>=20.0.0',
    supportedEngines: ['node', 'v8'],
    agentProtocols: ['MCP-1.30.0', 'ProjectMindAgent-v1'],
    dbSchemaRange: '>=1.0.0 <=2.0.0',
  },
  ...
};
```

---

## 2. Versioning & Compatibility Matrix

| Component | Target Version | Compatibility Policy |
|---|---|---|
| **Node.js Runtime** | `>=20.0.0` (Tested on v26) | Strict LTS and Active Node versions |
| **API Protocol** | `v1` | Semantic versioning; no breaking endpoint changes without `v2` bump |
| **MCP Integration** | `1.30.0` | Backward compatible with standard MCP clients (Cursor, Claude Desktop) |
| **Database Schema** | `2.0.0` | Backward compatible read access across versions 1.x and 2.x |
| **Agent Protocols** | `ProjectMindAgent-v1` | Supports capability negotiation and protocol handshake |

---

## 3. Schema Migration & Forward Migration Policy

1. **Transaction Isolation:** Every SQLite schema migration is wrapped inside a single atomic transaction. If any step fails, the database automatically rolls back to the previous version.
2. **Forward Migration Requirement:** Migrations must execute sequentially (`1.0.0` → `1.1.0` → `2.0.0`). Non-linear jumps or skipped versions are prohibited.
3. **Rollback Policy:** Destructive migrations (e.g. dropping columns or tables) must not be applied in-place without taking an automated pre-migration file snapshot. Rollback is achieved by snapshot restoration via `DisasterRecoveryManager`.

---

## 4. Rollback Playbook

If a critical platform regression is identified post-deployment:

### Step 1: Drain Inbound Traffic
```bash
curl -X POST http://localhost:3000/api/v1/admin/pause -H "Authorization: Bearer $ADMIN_TOKEN"
```
Pauses `AgentSessionManager` to prevent new tasks from being accepted.

### Step 2: Restore Database Snapshot
```bash
# Locate pre-deployment snapshot
cp /data/backups/projectmind_pre_v1.0.0.db /data/projectmind.db
cp /data/backups/projectmind_pre_v1.0.0.db-wal /data/projectmind.db-wal
```

### Step 3: Revert Application Image / Binary
Deploy previous container tag or release binary:
```bash
docker stop projectmind-v1
docker run -d --name projectmind-previous -v /data:/data projectmind:0.9.9
```

### Step 4: Verify Platform Health
```bash
curl http://localhost:3000/api/v1/health
```
Verify status is `HEALTHY` and components report version `0.9.9`.

### Step 5: Resume Inbound Traffic
```bash
curl -X POST http://localhost:3000/api/v1/admin/resume -H "Authorization: Bearer $ADMIN_TOKEN"
```
Re-enables external agent access.

---

## 5. Deployment Prerequisites Checklist
- [x] Node.js `>=20.0.0` installed.
- [x] Persistent volume allocated with write permissions for SQLite & Kuzu graph database.
- [x] `PROJECTMIND_SECRET_KEY` set (minimum 32 characters).
- [x] Zero development flags enabled (`NODE_ENV=production`, `PROJECTMIND_ENV=production`).
- [x] Pre-deployment snapshot verified and archived.
