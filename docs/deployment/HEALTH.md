# Health, Liveness & Readiness Architecture

## 1. Concepts & Distinctions

ProjectMind provides three distinct health abstractions:

1. **Liveness (`isAlive`)**:
   - Meaning: "The Node.js process is executing and event loop is responsive."
   - Requirement: Ultra-lightweight ($<1$ms). **Zero** repository scans, zero database queries, zero external network calls.
   - Response: `{ status: "alive", uptimeMs: 12345, timestamp: "..." }`.

2. **Readiness (`isReady`)**:
   - Meaning: "The platform has completed bootstrap and critical dependencies (Storage, EventBus, Agent Runtime) are ready to accept work."
   - Response: `{ ready: true, dependencies: { CONFIG: true, KERNEL: true, EVENT_BUS: true, AGENT_RUNTIME: true }, timestamp: "..." }`.

3. **Platform Health (`getHealth`)**:
   - Meaning: "Complete status of all registered subsystems."
   - Aggregation Logic:
     - If any required component is `UNHEALTHY` $\to$ overall is `UNHEALTHY`.
     - If any required component is `DEGRADED` $\to$ overall is `DEGRADED`.
     - Optional/disabled components do not mark the overall platform unhealthy.
   - Sanitization: Passwords, tokens, database URLs, and file paths are stripped before reporting.
