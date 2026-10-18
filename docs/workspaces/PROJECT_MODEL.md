# Canonical Project Model — Phase 9.2

## 1. Overview & Purpose

A **Project** in ProjectMind represents a logical software engineering unit. It is scoped strictly within a parent [Workspace](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/docs/workspaces/WORKSPACE_MODEL.md) and encapsulates:
- One or more linked repositories (`Project → Repositories`).
- Architectural models and symbol graphs.
- Discovered business domain features.
- Context budgets and optimization strategies.
- Agent session policies and runtime scope.

A Project is decoupled from raw source code trees: while a repository contains source files, a project synthesizes software architecture, features, and engineering context across those repositories.

---

## 2. Canonical Project Schema

The canonical [Project](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/workspace/models/Project.ts) interface:

```typescript
export interface Project {
  readonly projectId: string;               // Stable unique identifier (e.g. proj_1727715000_f8a9)
  readonly workspaceId: string;             // Mandatory parent workspace reference
  readonly name: string;                    // Display name (e.g. "Order Processing Engine")
  readonly slug: string;                    // Workspace-unique slug (e.g. "order-processing-engine")
  readonly description?: string;            // Project charter and purpose
  readonly status: ProjectStatusType;       // CREATED | INITIALIZING | ACTIVE | PAUSED | ARCHIVED | COMPLETED
  readonly projectType: ProjectType;        // SERVICE | APPLICATION | LIBRARY | MONOREPO | MULTI_REPO | INFRASTRUCTURE | RESEARCH
  readonly settings: ProjectSettings;       // Fine-grained analysis, context, feature, and agent configs
  readonly primaryRepositoryId?: string;    // Main repository identifier
  readonly repositoryIds: readonly string[]; // Multi-repository support
  readonly createdAt: string;               // ISO-8601 UTC timestamp
  readonly updatedAt: string;               // ISO-8601 UTC timestamp
  readonly version: number;                 // Optimistic concurrency counter
}
```

---

## 3. Project Types

| Type | Intended Use Case |
| :--- | :--- |
| `SERVICE` | Backend microservices, daemon processes, or background APIs. |
| `APPLICATION` | Web apps, desktop applications, mobile clients. |
| `LIBRARY` | Shared packages, SDKs, reusable UI or utility components. |
| `MONOREPO` | Large single-repository containing multiple apps and packages. |
| `MULTI_REPO` | Composite project referencing multiple distinct Git repositories. |
| `INFRASTRUCTURE` | Terraform, Kubernetes manifests, Helm charts, cloud topologies. |
| `RESEARCH` | Proofs of concept, algorithmic evaluations, exploratory prototypes. |

---

## 4. Multi-Repository Relationship

A project maintains explicit, tracked references to one or more concrete repositories via [ProjectRepositoryAssociation](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/workspace/models/ProjectRepository.ts):

```typescript
export interface ProjectRepositoryAssociation {
  readonly projectId: string;
  readonly repositoryId: string;
  readonly workspaceId: string;
  readonly repositoryPath?: string;
  readonly isPrimary: boolean;
  readonly attachedAt: string;
  readonly attachedBy: string;
}
```

### Safety and Isolation Constraints

1. **Workspace Boundary:** A repository can only be attached to a project belonging to the exact same workspace. Cross-workspace attachments throw `ScopeViolationError`.
2. **Conflict Prevention:** A repository cannot be bound to two separate projects simultaneously without explicit reassignment.
3. **Primary Repository Designation:** Every project tracks a primary repository for default context generation and CLI commands.

---

## 5. API Endpoints

| HTTP Method | Route | Description |
| :--- | :--- | :--- |
| `GET` | `/v1/workspaces/:workspaceId/projects` | Lists projects within a workspace. |
| `POST` | `/v1/workspaces/:workspaceId/projects` | Creates a new project in the workspace. |
| `GET` | `/v1/projects/:projectId` | Retrieves project details. |
| `PATCH` | `/v1/projects/:projectId` | Updates project metadata and configuration. |
| `POST` | `/v1/projects/:projectId/init` | Initializes and activates project state. |
| `POST` | `/v1/projects/:projectId/archive` | Archives the project. |
| `POST` | `/v1/projects/:projectId/restore` | Restores an archived project to `ACTIVE`. |
| `GET` | `/v1/projects/:projectId/repositories` | Lists all repositories attached to the project. |
| `POST` | `/v1/projects/:projectId/repositories` | Attaches a repository to the project. |
| `DELETE` | `/v1/projects/:projectId/repositories/:repoId` | Detaches a repository from the project. |
| `GET` | `/v1/projects/:projectId/context` | Resolves canonical `ProjectContext`. |

---

## 6. CLI Usage

```bash
# List projects in a workspace
projectmind project list --workspace ws_123

# Create a project
projectmind project create --name "BillingService" --workspace ws_123 --type SERVICE

# Initialize a project around current directory
projectmind project init --name "BillingService"

# Attach an additional repository
projectmind project attach repo_invoicing --project proj_456

# Show project status and attached repositories
projectmind project show proj_456
projectmind project status proj_456

# Archive a project
projectmind project archive proj_456
```
