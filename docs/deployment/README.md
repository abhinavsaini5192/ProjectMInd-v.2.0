# ProjectMind Platform — Deployment & Operations Guide

Welcome to the comprehensive deployment and operational documentation for the **ProjectMind Platform** (Phase 8.1).

## Overview

ProjectMind is an AI-native repository intelligence and context optimization platform. It maintains structured knowledge about software repositories and provides compact, explainable context to AI coding agents.

This deployment guide outlines how to configure, deploy, monitor, and operate ProjectMind reliably across diverse environments:
- **Local Development**: Developer workstations with hot-reloading and debug output.
- **Local Production Profile**: Single-machine execution with strict validation and structured JSON logging.
- **Containerized Deployment**: Multi-stage Docker containers with non-root security and healthcheck integration.
- **Enterprise & Cloud**: Standalone service deployments on AWS, Azure, GCP, or private infrastructure.

---

## Documentation Index

1. [Architecture](./ARCHITECTURE.md): Platform topology, service boundaries, and separation of concerns.
2. [Configuration](./CONFIGURATION.md): Environment variables, Zod validation, and secret handling.
3. [Local Development](./LOCAL.md): Setup, workflow, and developer tooling.
4. [Production Deployment](./PRODUCTION.md): Production deployment checklist, startup, and hardening.
5. [Containerization](./CONTAINERS.md): Docker, Docker Compose, and container security.
6. [Health & Readiness](./HEALTH.md): Liveness probes, readiness checks, and health aggregation.
7. [Observability & Metrics](./OBSERVABILITY.md): Structured logging, secret redaction, and metric counters.
8. [Security & Isolation](./SECURITY.md): Multi-tenant isolation, credentials, and non-root execution.
9. [Day-2 Operations](./OPERATIONS.md): Process lifecycle, graceful shutdown, and signal handling.
10. [Recovery & Resilience](./RECOVERY.md): Checkpointing, restart reconciliation, and failover.
11. [Troubleshooting](./TROUBLESHOOTING.md): Common error codes, failure diagnostics, and remediation.

---

## Quick Start (Production Container)

```bash
# 1. Clone repository & copy environment configuration
cp .env.example .env

# 2. Build and launch container stack
docker-compose up -d --build

# 3. Check container logs
docker-compose logs -f projectmind

# 4. Verify platform health
docker exec -it projectmind-platform node -e "require('./dist/platform/index.js')"
```
