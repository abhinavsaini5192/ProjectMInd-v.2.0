# Brain Subsystem Integration

## Overview

The Context Orchestrator exposes a high-level facade for the ProjectMind Brain subsystem via `ContextProvider` (`src/context/provider/ContextProvider.ts`), implementing `IContextProvider`.

## Integration Contract

```typescript
export interface IContextProvider {
  // Context resolution from natural language task prompt
  getContextForTask(task: string | ContextRequest): Promise<ContextPackage>;

  // Context resolution for a specific feature ID
  getContextForFeature(featureId: string, options?: Partial<ContextRequest>): Promise<ContextPackage>;

  // Context resolution triggered by a file / resource modification
  getContextForChange(change: ResourceChangeContextRef): Promise<ContextPackage>;

  // Context resolution for a specific list of resource paths
  getContextForResources(
    resourceIds: string[],
    repositoryId: string,
    workspaceId: string
  ): Promise<ContextPackage>;
}
```

## Usage Example in Brain Decision Engine

```typescript
import { ContextProvider } from '../context/provider/ContextProvider.js';

// Given a user prompt in Brain:
const contextPackage = await contextProvider.getContextForTask(
  'Fix payment gateway retry failure'
);

// Forward compiled prompt text to the active LLM agent:
const prompt = contextPackage.compiledPromptText;
```
