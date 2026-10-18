# Job Security & Tenant Isolation

## 1. Threat Model & Mitigations

Background workers execute with backend system privileges, creating potential vectors for privilege escalation, tenant boundary hopping, or secret exposure. Phase 8.6 implements defense-in-depth mitigations for the background processing subsystem:

| Threat Vector | Description | Mitigation in Phase 8.6 |
| :--- | :--- | :--- |
| **Cross-Workspace Data Access** | Job created in Workspace A executes mutations on Workspace B. | Strict workspace scoping in `JobSecurityContext` and validation in `JobAuthorizationValidator`. |
| **Privilege Escalation** | Low-privilege user queues an administrative or maintenance job. | Job submission and execution both verify actor permissions against required scopes. |
| **Secret Leakage** | API keys, tokens, or passwords stored in job arguments/payloads. | Automatic scanning and rejection of sensitive keys (`token`, `password`, `secret`, `apiKey`, etc.). |
| **Poison Payload / DoS** | Massive payload designed to exhaust queue memory. | Bounded payload size limits and strict schema validation prior to enqueue. |
| **Trust Manipulation** | Background job elevates unverified agent report to verified fact. | Verification handlers enforce provenance: `AGENT_REPORTED` status cannot be upgraded without independent system verification. |
| **Arbitrary Code Execution** | Attacker injects shell or Python code in job arguments. | Handlers do not evaluate shell commands; only canonical, pre-compiled application services are invoked. |

---

## 2. Job Security Context (`src/jobs/security/JobSecurityContext.ts`)

Every job carries an immutable security context established at ingestion time:

```typescript
export interface JobSecurityContext {
  workspaceId: string;
  repositoryId?: string;
  actor: {
    principalId: string;
    principalType: 'user' | 'agent' | 'system';
    roles: string[];
    scopes: string[];
  };
  provenance: {
    originatingIp?: string;
    sourceEventId?: string;
    sourceEventType?: string;
    correlationId: string;
    traceId: string;
  };
  createdAt: Date;
}
```

---

## 3. Authorization & Scope Validation (`JobAuthorizationValidator`)

Before a worker executes any job, the `JobAuthorizationValidator` (`src/jobs/security/JobAuthorizationValidator.ts`) performs a multi-stage validation check:

```
      Worker Dequeues Job
               │
               ▼
     ┌───────────────────────────────────┐
     │ 1. Workspace Isolation Check      │
     │    Matches originating workspace? │
     └─────────┬─────────────────────────┘
               │ Pass
               ▼
     ┌───────────────────────────────────┐
     │ 2. Principal Authorization Check  │
     │    Holds required role / scopes?  │
     └─────────┬─────────────────────────┘
               │ Pass
               ▼
     ┌───────────────────────────────────┐
     │ 3. Secret Detection Scan          │
     │    Contains passwords/tokens?     │
     └─────────┬─────────────────────────┘
               │ Pass
               ▼
     ┌───────────────────────────────────┐
     │ 4. Provenance Integrity Check     │
     │    Valid source and correlation?  │
     └─────────┬─────────────────────────┘
               │ Pass
               ▼
       Execute Registered Handler
```

### 3.1. Rejection of Secrets in Payloads
Payloads and metadata are recursively scanned. If any key matches blacklisted patterns (`/password|token|secret|apiKey|privateKey|bearer/i`), the job is immediately rejected with `JOB_PAYLOAD_INVALID`:

```typescript
export function containsSensitiveKeys(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false;
  for (const [key, value] of Object.entries(obj)) {
    if (/password|token|secret|apikey|privatekey|bearer/i.test(key)) {
      return true;
    }
    if (typeof value === 'object' && containsSensitiveKeys(value)) {
      return true;
    }
  }
  return false;
}
```

---

## 4. Verification Integrity & Provenance

Phase 8.6 Section 43 mandates that verification job wrappers must preserve original evidence source and trust levels:

> [!WARNING]
> A background job wrapper **must never upgrade** an `AGENT_REPORTED` observation into a `SYSTEM_VERIFIED` state simply by running it through a worker. Verification jobs must run actual compiler, linter, or AST verification passes before asserting system verification.

The `VerificationJobHandler` validates that:
1. `verificationSource` matches the authenticated actor.
2. Freshness timestamps fall within permitted validity windows.
3. Verification results reflect the outcome of the canonical verification engine, not self-reported agent assertions.
