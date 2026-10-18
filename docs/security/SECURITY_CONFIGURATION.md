# ProjectMind Security Configuration & Startup Validation (Phase 8.9)

## 1. Startup Security Configuration Validation

When ProjectMind boots in production or staging, `SecurityConfigValidator.validate` inspects configuration before entering `isReady() === true`:

1. **Production Debug Mode Check**:
   - `debugMode === true` in production or staging is flagged as a **CRITICAL** error, blocking platform readiness.
2. **Unsafe Development Defaults Check**:
   - `allowUnsafeDevDefaults === true` in production is rejected.
3. **Authentication Mode Check**:
   - `authMode === 'none'` in production is strictly prohibited.
4. **CORS Security Policy Check**:
   - Wildcard origin (`*`) with `allowCredentials: true` is rejected as an invalid CORS specification.
5. **Plaintext Secret Audit**:
   - Configuration objects are scanned for raw API key strings (`sk_...`); vault references (`vault://...`) are required.

## 2. Environment Matrix

| Parameter | Development | Staging | Production |
| :--- | :---: | :---: | :---: |
| `PROJECTMIND_ENV` | `development` | `staging` | `production` |
| `debugMode` | Optional | **false** | **false** |
| `allowUnsafeDevDefaults` | Allowed (for local unit tests) | **false** | **false** |
| `authMode` | `none` or `token` | `token` or `oauth` | `token` or `oauth` |
| `corsPolicy.allowCredentials` | `true` with localhost | `true` with whitelist | `true` with strict whitelist |
| `secretRedaction` | Enabled | **Enabled** | **Enabled** |
