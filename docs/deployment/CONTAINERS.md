# Containerized Deployment Guide

## 1. Multi-Stage Dockerfile

The ProjectMind `Dockerfile` uses a two-stage build to minimize image size and eliminate build-time tools from the production runtime:

1. **Stage 1 (`builder`)**: Uses `node:20-alpine`, installs full dependencies, and compiles TypeScript into `dist/`.
2. **Stage 2 (`runner`)**: Uses a clean `node:20-alpine` base, installs `dumb-init` for POSIX signal propagation, installs only production dependencies (`npm ci --omit=dev`), sets `USER node`, and adds a container `HEALTHCHECK`.

## 2. Docker Compose Deployment

```yaml
version: '3.8'

services:
  projectmind:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: projectmind-platform
    restart: unless-stopped
    environment:
      - PROJECTMIND_ENV=production
      - PROJECTMIND_LOG_LEVEL=INFO
      - PROJECTMIND_LOG_FORMAT=json
      - PROJECTMIND_STORAGE_TYPE=sqlite
      - PROJECTMIND_STORAGE_LOCATION=/app/.projectmind/data
    volumes:
      - projectmind-data:/app/.projectmind/data
    healthcheck:
      test: ["CMD", "node", "-e", "require('./dist/platform/index.js')"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s

volumes:
  projectmind-data:
    driver: local
```
