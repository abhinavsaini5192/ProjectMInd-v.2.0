# ProjectMind Agent Adapters — Migration & Compatibility Guide

## Upgrading from Phase 7.1 to Phase 7.9

Phase 7.1 established the initial foundation contract for provider adapters in `src/agent/interfaces/IAgentAdapter.ts` and an in-memory stub `AdapterRegistry.ts`.

Phase 7.9 introduces the full **Agent Adapter Architecture** while preserving 100% backward compatibility with all Phase 7.1 implementations and tests.

---

## 1. Backward Compatibility Matrix

| Phase 7.1 Feature | Phase 7.9 Replacement | Compatibility Status | Notes |
|---|---|---|---|
| `AdapterRegistry` | `AdapterRegistry` (extends `AgentAdapterRegistry`) | 100% Drop-in | All Phase 7.1 methods (`register`, `get`, `getByAgentType`, `list`) work unchanged |
| `IAgentAdapter.adaptRequest()` | `IAgentAdapter.translateRequest()` + `adaptRequest()` | 100% Compatible | `adaptRequest` delegates to normalized translation |
| `IAgentAdapter.adaptResponse()` | `IAgentAdapter.translateResponse()` + `adaptResponse()` | 100% Compatible | `adaptResponse` extracts native payload |
| `AgentTokens.IAdapterRegistry` | `AgentAdapterTokens.IAgentAdapterRegistry` | Fully Aliased | Both tokens resolve to the singleton registry in DI container |

---

## 2. Migration Steps for Existing Adapters

If you authored an adapter adhering to the Phase 7.1 `IAgentAdapter` interface:

```typescript
// Legacy Phase 7.1 Adapter
const legacyAdapter: IAgentAdapter = {
  id: 'my_agent',
  name: 'My Agent',
  targetAgentType: 'CLI_AGENT',
  supportedProtocolVersions: ['1.0'],
  adaptRequest: async (input) => ({ ... }),
  adaptResponse: async (response) => ({ ... })
};
```

### Option A: No Changes Required
The new `AdapterRegistry` continues to accept Phase 7.1 adapters directly.

### Option B: Recommended Upgrade to Phase 7.9
Implement the complete `IAgentAdapter` interface or extend `GenericAgentAdapter`:
1. Add `metadata: AdapterMetadata` declaring exact provider, protocol, and capabilities.
2. Implement `translateRequest` returning normalized `AdapterRequest`.
3. Implement `translateResponse` returning normalized `AdapterResponse`.
4. Benefit from automated validation, security enforcement, deterministic resolution, and failure isolation.
