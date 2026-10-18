# Production Security & Boundary Controls

## 1. Multi-Tenant Workspace & Repository Isolation

All platform operations (sessions, tasks, context retrieval, tool execution, and state checkpoints) are scoped strictly by `workspaceId` and `repositoryId`.
Cross-workspace attempts to access another tenant's session or task throw `PlatformError` (`VALIDATION_ERROR` or `RESOURCE_NOT_FOUND`).

## 2. External Error Sanitization

The `ProductionErrorBoundary` ensures external clients never receive internal implementation details:
- Stack traces are completely stripped when `PROJECTMIND_ENV !== 'development'`.
- Database error messages, internal paths, SQL queries, and secrets are sanitized.
- Safe external error envelopes follow the RFC 7807 problem details pattern:
  ```json
  {
    "error": {
      "code": "SERVICE_UNAVAILABLE",
      "message": "ProjectMind is temporarily unavailable.",
      "requestId": "req_12345",
      "correlationId": "corr_67890"
    }
  }
  ```

## 3. Container Security

- **Non-Root Execution**: Runs under UID `1000` (`USER node`).
- **Read-Only Compatibility**: Root filesystem can be mounted read-only with a writable mount at `/app/.projectmind/data`.
- **Zero Secrets in Images**: Configuration is provided at runtime via environment variables, never baked into Docker images.
