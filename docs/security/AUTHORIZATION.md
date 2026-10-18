# ProjectMind Authorization & Access Control (Phase 8.9)

## 1. Deterministic RBAC Model

ProjectMind enforces deterministic Role-Based Access Control (RBAC). Authorization decisions are never delegated to an LLM or statistical model.

### Canonical Roles & Privileges

| Role | Intended Principals | Granted Permissions | Prohibited Actions |
| :--- | :--- | :--- | :--- |
| `ADMIN` | Platform / Workspace Administrators | `*` within assigned scope | Cross-workspace operations (unless global admin) |
| `DEVELOPER` | Software Engineers | Read & Write features, context, knowledge, tools | Security policy modification, disaster restore |
| `AGENT` | Autonomous Coding Agents | Read context/features; report observations | Self-elevation, security admin, disaster restore |
| `READONLY` | Read-only viewers / auditors | Read-only operations on features & context | Mutations, observation reports, tool executions |
| `GUEST` | Unassigned / new users | Scoped read-only access to public repo metadata | All mutations, private context queries |

## 2. Default Deny & Scope Containment

- If a requested permission is not explicitly present in the principal's role assignment for the requested resource scope, the operation is **strictly denied** with `AUTHORIZATION_DENIAL`.
- Scope containment is evaluated hierarchically by `CrossScopeGuard` and `ScopeValidator`.
- A principal authorized for `ws:alpha` cannot access `ws:beta` even if both workspaces have identical role names.

## 3. Separation of Capabilities and Permissions

- **Permission**: Represents what a principal is authorized to perform (e.g. `feature:read`).
- **Capability**: Represents technical tool functionality supported by an agent (e.g. `READ_CONTEXT`).
- Both are required: an agent with the `READ_CONTEXT` capability is denied if its role lacks the `feature:read` permission.
