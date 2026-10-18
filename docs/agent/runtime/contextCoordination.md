# Context Coordination & Refresh Policies

## 1. Context Delivery

The Context Coordinator interfaces with `IAgentContextSessionManager` to deliver compact, structured `ContextPackage` objects tailored for external LLMs.

## 2. Refresh Policies

The runtime supports four distinct `ContextRefreshPolicy` configurations:

- `IMMEDIATE`: Context sessions are refreshed immediately upon detection of staleness (e.g. knowledge graph updates or execution reports).
- `ON_NEXT_REQUEST`: Context staleness flags are updated asynchronously; the next time `getContext()` is called, a refresh is triggered seamlessly. (Default)
- `LAZY`: Context packages are cached and only refreshed when explicitly requested or when a delta threshold is exceeded.
- `MANUAL`: Context is only updated when external agents explicitly call `refreshContext()`.
