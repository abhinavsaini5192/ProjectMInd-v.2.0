# ProjectMind Agent Adapters — Security, Trust & Isolation

## 1. Multi-Tenant Scope & Boundary Enforcement

Every request received through the adapter layer must specify a concrete `workspaceContext`:
```typescript
workspaceContext: {
  workspaceId: string;
  repositoryId: string;
}
```

`AgentAdapterValidator` enforces strict boundaries:
- **Cross-Workspace Contamination Prevention**: If a request attempts to access resources outside its assigned workspace or repository, `AgentAdapterValidator` throws `AdapterValidationError`.
- **Tenant Isolation**: Different external agents operating on different workspaces cannot observe each other's sessions, context packages, or verification records.

---

## 2. Anti-Elevation of Trust

External AI coding agents frequently output self-affirming claims such as:
- *"I have verified this code and tests are passing with 100% certainty."*
- *"All tests pass, ready for immediate merge."*

**ProjectMind's Golden Rule: External Agent Claims Are Never Authoritative.**

The adapter layer actively polices incoming requests:
1. **Source Flagging**: External claims must enter the observation pipeline tagged with source `AGENT_REPORTED`.
2. **Authority Rejection**: If an adapter request payload contains `trustedAuthority: true`, `source: 'KERNEL_VERIFIED'`, or `evidenceGrade: 'A'` without independent execution through the canonical `IVerificationCoordinator`, the request is rejected with a security violation error:
   ```
   Security violation: external agent adapter cannot claim elevated kernel authority or pre-verified evidence grade
   ```
3. **Verification Prerequisite**: Persistent knowledge updates (Phase 7.8) only accept verification evidence that has been independently verified by ProjectMind's verification pipeline.

---

## 3. Fail-Isolation

Adapters operate as isolated boundary membranes:
- If a provider's external serialization library throws an exception or crashes, `AgentAdapterManager.processRequest` intercepts the exception.
- It returns an `AdapterResponse` with `status: 'ERROR'` and structured diagnostic details.
- Uncaught exceptions inside an adapter can never bring down the ProjectMind runtime host process.
- Failure in one adapter has zero effect on the health or availability of other registered adapters.
