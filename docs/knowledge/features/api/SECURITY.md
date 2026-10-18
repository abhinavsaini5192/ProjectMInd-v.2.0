# Security, Isolation & Read-Only Guarantees

## Security Boundaries

### 1. Workspace & Repository Isolation
Queries optionally include `workspaceId` and `repositoryId`.
During resolution, `FeatureKnowledgeResolver` verifies that the requested feature matches the query's scope:
```typescript
if (query.workspaceId && feature.workspaceId && feature.workspaceId !== query.workspaceId) {
  throw new FeatureKnowledgeAccessError(`Feature '${featureId}' does not belong to workspace '${query.workspaceId}'`);
}
```
This guarantees strict multi-tenant isolation and prevents cross-repository leakage.

---

### 2. Secret Redaction & Sanitization
Responses undergo automatic sanitization via `FeatureKnowledgeSerializer.sanitizeObject(...)`:
- Any object key containing `password`, `secret`, `token`, `apikey`, `privatekey`, `credentials`, or `authorization` (case-insensitive) is replaced with `'[REDACTED]'`.
- Raw environment variables or database credentials embedded in metadata are neutralized.

---

### 3. Read-Only Guarantee
Phase 6.9 is strictly read-only:
- It exposes no `create`, `update`, `delete`, or `mutate` methods.
- It does not invoke parsers, git write operations, or trigger background analyses.
- Subsystem calls are strictly queries (`get`, `getMappings`, `getBehavior`, `getByFeatureId`, `getHistory`).
