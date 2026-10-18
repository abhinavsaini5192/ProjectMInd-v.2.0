# Operational Troubleshooting Guide

## 1. Diagnostic Decision Tree

```
Platform Startup Fails?
│
├── Error: CONFIG_VALIDATION_FAILED
│   └── Resolution: Review environment variables and ensure non-empty parameters.
│
├── Error: INITIALIZATION_ERROR
│   └── Resolution: Check database directory permissions (/app/.projectmind/data) and disk space.
│
└── Readiness Probe Returns Not Ready?
    └── Resolution: Inspect component statuses in getReadiness() or getHealth().
```

## 2. Common Errors & Resolution

| Error Code | Root Cause | Remediation |
| :--- | :--- | :--- |
| `CONFIG_VALIDATION_FAILED` | Invalid numeric range or schema violation | Check `.env` against `.env.example` specifications. |
| `INITIALIZATION_ERROR` | Storage directory unwritable or locked | Ensure persistent volume is writable by user `node` (UID 1000). |
| `SERVICE_UNAVAILABLE` | Platform is in `STOPPING` or `RECOVERING` state | Wait for graceful recovery to complete, or inspect crash logs. |
| `RATE_LIMITED` | Concurrent session or task capacity exceeded | Scale `PROJECTMIND_MAX_SESSIONS` or `PROJECTMIND_MAX_TASKS`. |
| `TIMEOUT` | Tool execution deadline reached | Increase `PROJECTMIND_TOOL_TIMEOUT_MS`. |
