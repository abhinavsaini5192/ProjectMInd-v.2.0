# Dependency Injection & Token Registration

## DI Architecture

All services in the Context Orchestration layer are registered in ProjectMind's `DIContainer` via `ContextOrchestratorDISetup` (`src/context/di/ContextOrchestratorDISetup.ts`).

## Injection Tokens (`ContextTokens`)

| Token | Service / Interface | Lifetime |
| :--- | :--- | :--- |
| `ContextTokens.IContextOrchestrator` | `ContextOrchestrator` | Singleton |
| `ContextTokens.IContextPlanner` | `ContextPlanner` | Singleton |
| `ContextTokens.IContextRetriever` | `ContextRetrievalCoordinator` | Singleton |
| `ContextTokens.IContextSelector` | `ContextSelector` | Singleton |
| `ContextTokens.ITokenBudgetManager` | `TokenBudgetManager` | Singleton |
| `ContextTokens.IContextPacker` | `ContextPackageBuilder` | Singleton |
| `ContextTokens.IContextProvider` | `ContextProvider` | Singleton |
| `ContextTokens.IContextExplanationService` | `ContextExplanationService` | Singleton |
| `ContextTokens.AdapterRegistry` | `AdapterRegistry` | Singleton |
| `ContextTokens.ContextCache` | `ContextCache` | Singleton |

## Registration Example

```typescript
import { DIContainer } from '../workspace/di/DIContainer.js';
import { ContextOrchestratorDISetup } from '../context/di/ContextOrchestratorDISetup.js';

const container = new DIContainer();

ContextOrchestratorDISetup.register(container, {
  featureKnowledgeApi,
  featureRepository,
  mappingRepository,
});

// Resolving the orchestrator
const orchestrator = container.resolve(ContextTokens.IContextOrchestrator);
```
