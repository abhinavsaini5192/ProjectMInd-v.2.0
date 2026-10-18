# ProjectMind Production API & Service Interface Layer

Welcome to the **ProjectMind Production API and Service Interface Layer** (Phase 8.3).

This layer establishes the canonical, provider-neutral production interface boundary through which external clients, web applications, integrations, SDKs, CLI tools, and agent platforms communicate with ProjectMind.

---

## 1. Core Architectural Principle

> **THE API LAYER IS AN INTERFACE BOUNDARY, NOT A SECOND APPLICATION LAYER.**

```
External Client / SDK / Agent
              ↓
        HTTP Transport (HttpAdapter)
              ↓
     API Pipeline & Middleware
              ↓
       Authentication (Phase 8.2)
              ↓
       Authorization (Phase 8.2)
              ↓
        Scope Validation
              ↓
         API Controller
              ↓
    Canonical ProjectMind Services
 (Context, Feature, Knowledge, Agent, Verification)
              ↓
       Response Formatting
              ↓
      Standardized API Response
```

The API layer coordinates transport concerns, contract serialization, version resolution, authentication integration, authorization verification, scope enforcement, idempotency tracking, and rate limiting. It **never** duplicates domain logic, repository intelligence, context reasoning, agent execution, or knowledge storage.

---

## 2. Directory Layout

The API foundation is located at [`src/api/`](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/api):

```
src/api/
├── adapters/          # Transport adapters (Node HTTP, server creation)
├── contracts/         # Provider-neutral request, response, metadata, pagination, filtering, sorting
├── controllers/       # Controller endpoints delegating to canonical domain services
├── di/                # Dependency injection tokens and container setup
├── documentation/     # Dynamic OpenAPI 3.1 schema generator
├── errors/            # RFC 7807 problem details, error codes, and exception mapper
├── idempotency/       # Idempotency service, memory store, and hash validation
├── middleware/        # Request correlation, auth, authz, scope, rate limit, telemetry
├── models/            # Domain-specific request and response payload models
├── ratelimit/         # Rate limiting policy, token bucket/window limiter
├── routing/           # Route pattern compiler, matcher, and API router
├── services/          # High-level API orchestration, request & response normalization
└── versioning/        # Version resolution (path, header, accept), compatibility, deprecation
```

---

## 3. Documentation Index

Detailed documentation for each aspect of the API is provided in this directory:

- [API Architecture](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/docs/api/API_ARCHITECTURE.md)
- [API Versioning & Evolution](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/docs/api/API_VERSIONING.md)
- [API Security & Scoping](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/docs/api/API_SECURITY.md)
- [API Error Contracts (RFC 7807)](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/docs/api/API_ERRORS.md)
- [API Contracts & Serialization](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/docs/api/API_CONTRACTS.md)
- [API Lifecycle & Middleware Pipeline](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/docs/api/API_LIFECYCLE.md)

---

## 4. Supported Endpoints Overview

| Category | Route | Method | Description |
| :--- | :--- | :--- | :--- |
| **Health** | `/health`, `/health/live`, `/health/ready` | `GET` | Platform liveness, readiness, and subsystem health |
| **Capabilities** | `/v1/capabilities` | `GET` | Machine-readable API discovery |
| **Workspace** | `/v1/workspaces`, `/v1/workspaces/:workspaceId` | `GET` | Workspace and repository listings |
| **Repository** | `/v1/workspaces/:workspaceId/repositories/:repositoryId` | `GET` | Repository state and architecture |
| **Context** | `.../context/orchestrate` | `POST` | Orchestrates context package via Context Orchestrator |
| **Context** | `.../context/plan` | `POST` | Generates context planning graph |
| **Context** | `.../context/estimate` | `POST` | Estimates token budget for query |
| **Context** | `.../context/sessions` | `POST` | Creates stateful agent context session |
| **Feature** | `.../features`, `.../features/:featureId` | `GET` | Lists, queries, and fetches feature profiles |
| **Feature** | `.../features/:featureId/summary` | `GET` | Retrieves feature summary and purpose |
| **Feature** | `.../features/:featureId/dependencies` | `GET` | Traces feature dependency relationships |
| **Feature** | `.../features/:featureId/health` | `GET` | Inspects verification quality and criticality |
| **Knowledge** | `.../knowledge-updates` | `POST` | Submits knowledge mutations with provenance |
| **Knowledge** | `.../knowledge-updates/version` | `GET` | Retrieves repository knowledge version |
| **Agent** | `/v1/runtime/sessions` | `POST` | Initiates agent runtime session |
| **Agent** | `/v1/runtime/sessions/:sessionId/tasks` | `POST` | Submits task execution to Agent Runtime |
| **Agent** | `.../tasks/:taskId/execute` | `POST` | Executes canonical tool call with session context |
| **Verification** | `.../verification/process` | `POST` | Ingests raw verification results with validation |
| **Verification** | `.../verification/records/:id` | `GET` | Fetches normalized verification evidence |
