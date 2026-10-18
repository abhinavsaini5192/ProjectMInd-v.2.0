# ProjectMind Security Testing & Regression Suite (Phase 8.9)

## 1. Security Testing Strategy

ProjectMind security assertions are verified continuously through deterministic unit, integration, and boundary regression tests.

The platform executes a 17-file security test suite in `tests/security/`, including the master regression suite in `securityRegressionSuite.test.ts`.

## 2. Regression Suite Sections (A through M)

| Section | Focus Area | Key Assertions Tested |
| :--- | :--- | :--- |
| **A. Authentication** | Credential validation & lifecycle | Rejects invalid keys, disabled identities, revoked credentials, and expired sessions |
| **B. Authorization** | RBAC & Default Deny | Denies unauthorized actions, prevents privilege escalation to policy admin |
| **C. Scope** | Multi-tenant isolation | Enforces workspace isolation and repository isolation within same workspace |
| **D. Agents** | Anti-elevation & Trust | Rejects agents attempting to self-escalate or assert `SYSTEM_VERIFIED` |
| **E. API** | Input validation & IDOR | Rejects IDOR attempts querying victim workspace resources |
| **F. MCP** | Tool security authorizer | Enforces RBAC permissions and scope checks on JSON-RPC MCP tool calls |
| **G. Jobs** | Background worker security | Rejects worker executing cross-tenant jobs |
| **H. Context** | Context generation & cache | Prevents cross-tenant context leaks using scoped cache keys |
| **I. Knowledge** | Knowledge updates | Blocks forged system provenance on interactive client updates |
| **J. Verification** | Test & CI evidence | Distinguishes `AGENT_REPORTED` from verified CI test evidence |
| **K. Recovery** | Disaster recovery security | Rejects restore operations lacking authenticated operator identity |
| **L. Secrets** | Leakage prevention | Verifies pre-log redaction of tokens and keys |
| **M. Prompt Injection** | Data vs instruction boundary | Neutralizes hostile prompt injection directives in repository markdown |

## 3. Running the Security Regression Suite

Execute the security tests locally using Vitest:

```bash
npx vitest run tests/security/
```
