# Agent Adapters Foundation (Phase 7.1) & Roadmap (Phase 7.2+)

## 1. Provider-Neutral Adapter Foundation

Phase 7.1 establishes the foundational provider-neutral adapter contract and registry. In Phase 7.1, the adapter registry is initialized clean without provider-specific code, establishing clean extension points for subsequent phases.

### Adapter Contract (`IAgentAdapter`)

```typescript
export interface IAgentAdapter<TNativeRequest = unknown, TNativeResponse = unknown> {
  readonly id: string;
  readonly name: string;
  readonly targetAgentType: AgentType;
  readonly supportedProtocolVersions: readonly string[];

  adaptRequest(input: TNativeRequest): Promise<AgentRequest>;
  adaptResponse(response: AgentResponse): Promise<TNativeResponse>;
}
```

### Adapter Registry (`AdapterRegistry`)
- `register(adapter: IAgentAdapter): void`
- `get(id: string): IAgentAdapter | undefined`
- `getByAgentType(type: AgentType): IAgentAdapter[]`
- `list(): IAgentAdapter[]`

---

## 2. Phase 7.2+ Adapter Roadmap

Future phases will provide concrete adapter implementations conforming to `IAgentAdapter`:

| Phase | Planned Adapter | Target Agent / Environment | Interaction Medium |
|:---|:---|:---|:---|
| **7.2** | `ClaudeCodeAdapter` | Claude Code CLI | JSON CLI Pipe / RPC / Subprocess stdin |
| **7.3** | `CursorAdapter` | Cursor IDE Extension | Language Server Protocol (LSP) / IPC |
| **7.4** | `CodexAdapter` | OpenAI Codex / API Clients | OpenAI Tools API Schema / Function Calling |
| **7.5** | `GeminiCliAdapter` | Gemini CLI / Developer SDK | Google Antigravity Sidecar & Tools |
| **7.6** | `CustomAgentAdapter` | Enterprise in-house agents | REST / WebSocket / JSON-RPC Gateway |

---

## 3. How Adapters Integrate

When adapters are implemented in Phase 7.2+:
1. Native client receives input from external agent UI/CLI.
2. Adapter translates native payload into a canonical `AgentRequest<TPayload>`.
3. `AgentRuntime.executeOperation(request)` executes the request against ProjectMind.
4. Adapter converts `AgentResponse<TData>` into native provider format (e.g., Markdown prompt for Claude, LSP code action for Cursor, tool response for Codex).
