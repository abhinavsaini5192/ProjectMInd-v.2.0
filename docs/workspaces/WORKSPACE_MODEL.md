# Workspace Model Architecture — Phase 9.2

## 1. Overview & Conceptual Hierarchy

In ProjectMind, a **Workspace** is the canonical organizational, tenant, and security boundary. It groups software engineering projects, access control policies, members, and organizational settings.

The fundamental platform hierarchy is:

```text
User / Principal
  ↓
Workspace (Organizational & Tenant Boundary)
  ↓
Project (Logical Software Engineering Project)
  ↓
Repository (Concrete Source-Code Repository)
  ↓
Project Knowledge
  ├── Features
  ├── Architecture
  ├── History
  ├── Context
  ├── Tasks
  ├── Agent Sessions
  └── Intelligence
```

### Distinction Between Core Entities

| Entity | Description | Lifecycle Responsibility |
| :--- | :--- | :--- |
| **Workspace** | Organization / Security Boundary | Governs membership, global billing, tenant isolation, and workspace-wide policies. |
| **Project** | Logical Software System | Encapsulates one or more code repositories, domain features, tasks, and project context. |
| **Repository** | Concrete Codebase | Source code tree, Git history, local ASTs, and physical file storage. |

---

## 2. Canonical Workspace Entity

The canonical [Workspace](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/workspace/models/Workspace.ts) schema:

```typescript
export interface Workspace {
  readonly workspaceId: string;           // Stable unique identifier (e.g. ws_1727715000_a1b2c3d4)
  readonly name: string;                  // Display name
  readonly slug: string;                  // URL & CLI friendly slug (unique across platform)
  readonly description?: string;          // Optional workspace summary
  readonly status: WorkspaceStatusType;   // ACTIVE | SUSPENDED | ARCHIVED | DELETED
  readonly ownerId: string;               // Principal ID of workspace creator
  readonly settings: WorkspaceSettings;   // Tenant-level policies and defaults
  readonly metadata?: Record<string, unknown>;
  readonly createdAt: string;             // ISO-8601 UTC timestamp
  readonly updatedAt: string;             // ISO-8601 UTC timestamp
  readonly version: number;               // Optimistic concurrency counter (1, 2, 3...)
}
```

### Workspace Statuses & Lifecycle

- `ACTIVE`: Fully operational. Projects and repositories can be added, scanned, and queried.
- `SUSPENDED`: Temporarily restricted due to administrative policy or security lock. Read/write operations are rejected with `WORKSPACE_NOT_ACTIVE`.
- `ARCHIVED`: Read-only historical retention. Mutations and executions are blocked. Can be restored to `ACTIVE`.
- `DELETED`: Soft-deleted tenant boundary. Preserved for audit and legal compliance.

---

## 3. Membership & Access Control

Workspaces integrate directly with Phase 8 Identity & Access Management via [WorkspaceMember](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/workspace/models/WorkspaceMember.ts).

### Roles

- `OWNER`: Full administrative control, billing, member management, and workspace deletion.
- `ADMIN`: Configuration, member invite/revocation, project creation, and policy assignment.
- `MAINTAINER`: Project configuration, repository attachment, analysis trigger.
- `DEVELOPER`: Standard read/write access to project features, context generation, and agent sessions.
- `VIEWER`: Read-only access to features, architecture diagrams, and inspection reports.

---

## 4. API Endpoints

| HTTP Method | Route | Description |
| :--- | :--- | :--- |
| `GET` | `/v1/workspaces` | Lists workspaces accessible by the current security context. |
| `POST` | `/v1/workspaces` | Creates a new workspace. Caller becomes `ADMIN` member. |
| `GET` | `/v1/workspaces/:workspaceId` | Retrieves workspace details. |
| `PATCH` | `/v1/workspaces/:workspaceId` | Updates name, description, and settings. |
| `POST` | `/v1/workspaces/:workspaceId/archive` | Archives workspace. |
| `POST` | `/v1/workspaces/:workspaceId/restore` | Restores an archived workspace to `ACTIVE`. |
| `GET` | `/v1/workspaces/:workspaceId/members` | Lists members with their assigned roles. |
| `POST` | `/v1/workspaces/:workspaceId/members` | Adds or updates a workspace member. |

---

## 5. CLI Usage

```bash
# List all workspaces
projectmind workspace list

# Create a new workspace
projectmind workspace create --name "Platform Engineering" --slug platform

# Inspect workspace details
projectmind workspace show ws_1727715000_a1b2c3d4

# Archive and restore
projectmind workspace archive ws_1727715000_a1b2c3d4
projectmind workspace restore ws_1727715000_a1b2c3d4
```
