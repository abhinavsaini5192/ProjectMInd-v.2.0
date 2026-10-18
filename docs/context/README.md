# ProjectMind Context Orchestrator & AI Prompt Adaptation (Phase 6.10)

## Overview

The **Context Orchestrator** is ProjectMind's prompt delivery engine. It translates deep repository intelligence (features, code mappings, behavioral flows, dependency graphs, health metrics, impact analysis, and historical evolution) into compact, highly relevant, token-budgeted prompt payloads optimized for LLM coding assistants.

## Quick Start

```typescript
import { ContextOrchestrator } from 'src/context/orchestrator/ContextOrchestrator.js';
import { ContextRetrievalCoordinator } from 'src/context/retrieval/ContextRetrievalCoordinator.js';

// Instantiate orchestrator with your FeatureKnowledgeAPI
const retriever = new ContextRetrievalCoordinator(featureKnowledgeApi);
const orchestrator = new ContextOrchestrator(retriever);

// Generate context for a developer task
const response = await orchestrator.orchestrateContext({
  taskText: 'Fix session expiration timeout in authentication service',
  repositoryId: 'my-org/my-repo',
  workspaceId: 'ws-main',
  tokenBudget: 4000,
  outputFormat: 'claude-xml', // or 'generic-markdown', 'openai-markdown', etc.
});

console.log(response.formattedPrompt);
```

## Documentation Index

- [Architecture Overview](./architecture.md)
- [Orchestration Pipeline](./orchestration-pipeline.md)
- [Planning Subsystem](./planning-subsystem.md)
- [Retrieval Coordination](./retrieval-coordination.md)
- [Relevance & Scoring Algorithms](./relevance-and-scoring.md)
- [Token Budgeting & Section Quotas](./token-budgeting-and-quotas.md)
- [Packaging & Canonical Model](./packaging-and-canonical-model.md)
- [Model Adapters Guide](./model-adapters.md)
- [Caching & Freshness Policies](./caching-and-freshness.md)
- [Security, Sanitization & Boundary Isolation](./security-and-sanitization.md)
- [Brain Subsystem Integration](./brain-integration.md)
- [Dependency Injection Setup](./dependency-injection.md)
- [Errors & Troubleshooting](./errors-and-troubleshooting.md)
- [Performance & Limits](./performance-and-limits.md)
- [Testing Guide](./testing-guide.md)
