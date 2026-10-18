# Production Deployment Guide

## 1. Production Checklist

Before running ProjectMind in a production environment:

1. **Environment Flag**: Set `PROJECTMIND_ENV=production`.
2. **Persistent Storage**: Ensure `PROJECTMIND_STORAGE_TYPE=sqlite` and `PROJECTMIND_STORAGE_LOCATION` points to a persistent, backed-up volume.
3. **Structured Logging**: Leave `PROJECTMIND_LOG_FORMAT=json` and `PROJECTMIND_LOG_LEVEL=INFO` (do not use `DEBUG` in production).
4. **Secret Redaction**: Ensure `PROJECTMIND_SECRET_REDACTION_ENABLED=true` (default).
5. **Non-Root Execution**: Run the process as a non-privileged user (e.g. `USER node` in Docker).
6. **Graceful Shutdown**: Forward `SIGTERM` and `SIGINT` to allow in-flight task checkpointing.

## 2. Production Startup

```bash
# Build the TypeScript codebase
npm run build || npx tsc

# Launch using production profile
node dist/platform/main.js
```
