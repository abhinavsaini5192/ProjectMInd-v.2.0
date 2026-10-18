# ProjectMind Agent Adapters — Troubleshooting & Diagnostics

## Common Issues and Solutions

### 1. `AgentAdapterNotFoundError`
- **Symptom**: `AgentAdapterNotFoundError: No compatible agent adapter found matching resolution criteria: ...`
- **Root Cause**: The requested `adapterId`, `provider`, or `protocol` is not registered in the `AgentAdapterRegistry`.
- **Solution**:
  - Verify adapter registration during startup via `container.resolve(AgentAdapterTokens.IAgentAdapterRegistry).list()`.
  - Check spelling of the adapter ID or protocol.

---

### 2. Version Incompatibility (`AdapterVersionIncompatibleError` / `INCOMPATIBLE`)
- **Symptom**: Compatibility assessment returns `status: 'INCOMPATIBLE'`.
- **Root Cause**: The client requested a major protocol version (e.g. `2.0`) that does not match the adapter's supported major version (e.g. `1.0`).
- **Solution**:
  - Update the client request to use the compatible protocol version.
  - Or register an adapter supporting the requested protocol version.

---

### 3. Capability Degradation (`PARTIAL` or `UNSUPPORTED`)
- **Symptom**: Adapter compatibility returns `PARTIAL` or `UNSUPPORTED` with warnings.
- **Root Cause**: The client requested capabilities (e.g. `STREAMING`, `MCP`, `BATCH_REQUESTS`) not supported by a minimal CLI or IDE adapter.
- **Solution**:
  - Inspect `result.unsupportedCapabilities`.
  - Provide fallback handling for missing capabilities, or route to an adapter with broader capability support (e.g. `GenericAgentAdapter`).

---

### 4. Scope Boundary Violation (`AdapterValidationError`)
- **Symptom**: `Workspace scope mismatch: request references [ws_b:repo_b] but expected [ws_a:repo_a]`.
- **Root Cause**: An external agent attempted to send a request containing a different workspace ID or repository ID than the one currently active.
- **Solution**:
  - Ensure the external agent client transmits the active workspace and repository IDs in its payload.

---

### 5. Anti-Elevation Rejection
- **Symptom**: `Security violation: external agent adapter cannot claim elevated kernel authority or pre-verified evidence grade`.
- **Root Cause**: External agent payload attempted to set `trustedAuthority: true`, `source: 'KERNEL_VERIFIED'`, or `evidenceGrade: 'A'`.
- **Solution**:
  - External agents must submit raw execution observations. Verification must be executed through canonical verification tools (`projectmind_report_verification` or `projectmind_run_verification`).
