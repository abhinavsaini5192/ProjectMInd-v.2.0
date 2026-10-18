# Phase 8.2 Role-Based Access Control (RBAC) Matrix

## 1. Canonical Roles

ProjectMind implements a standard set of hierarchical roles designed for enterprise multi-tenancy:

| Role ID | Target Persona | Scope Level | Description |
| :--- | :--- | :--- | :--- |
| **SYSTEM** | Internal Kernel & Platform Services | Global | Full control over internal platform operations. Cannot be assumed by external clients. |
| **SUPER_ADMIN**| Platform Super Administrators | Global | Full administrative access across all workspaces, tenants, and policies. |
| **OWNER** | Workspace Owners | Workspace | Full administrative control over a specific workspace and all contained repositories. |
| **MAINTAINER** | Technical Leads / Repository Admins | Workspace / Repo | Can modify repositories, manage features, and review knowledge updates. |
| **MEMBER** | Human Developers | Workspace / Repo | Can read context, initiate tasks, and submit observations. |
| **VIEWER** | Auditors / Read-only Users | Workspace / Repo | Read-only access to context, knowledge graph, and audit records. |
| **AGENT** | External AI Coding Agents | Task / Session / Repo | Strictly restricted operational role for context retrieval and observation reporting. |

---

## 2. Resource-Action Permission Matrix

The table below outlines permissions for each canonical role across primary resource types:

| Resource Type | Action | SYSTEM | SUPER_ADMIN | OWNER | MAINTAINER | MEMBER | VIEWER | AGENT |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **WORKSPACE** | `READ` | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :x: |
| | `WRITE` | :white_check_mark: | :white_check_mark: | :white_check_mark: | :x: | :x: | :x: | :x: |
| | `ADMINISTER`| :white_check_mark: | :white_check_mark: | :white_check_mark: | :x: | :x: | :x: | :x: |
| **REPOSITORY**| `READ` | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| | `WRITE` | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :x: | :x: | :x: |
| | `DELETE` | :white_check_mark: | :white_check_mark: | :white_check_mark: | :x: | :x: | :x: | :x: |
| **CONTEXT** | `READ` | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| | `OPTIMIZE` | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :x: | :white_check_mark: |
| **KNOWLEDGE** | `READ` | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| | `UPDATE` | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :x: | :x: | :x: |
| **TASK** | `READ` | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| | `EXECUTE` | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :x: | :white_check_mark: |
| **OBSERVATION**| `REPORT` | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :x: | :white_check_mark: |
| | `READ` | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| **VERIFICATION**| `REPORT` | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :x: | :white_check_mark: |
| | `CERTIFY` | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :x: | :x: | :x: |
| **POLICY** | `ADMINISTER`| :white_check_mark: | :white_check_mark: | :white_check_mark: | :x: | :x: | :x: | :x: |
| **AUDIT** | `READ` | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :x: | :white_check_mark: | :x: |

---

## 3. AGENT Role Constraints

The `AGENT` role is subject to strict deterministic policy guardrails:
1. **No System Administration**: Cannot manage users, assign roles, or change security policies.
2. **No Arbitrary Shell Execution**: Cannot run shell commands or arbitrary processes.
3. **No Direct Knowledge Mutation**: Cannot directly update the knowledge graph without going through verification.
4. **No Cross-Tenant Queries**: Access is strictly confined to the assigned workspace and repository.
