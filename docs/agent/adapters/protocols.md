# ProjectMind Agent Adapters — Protocols & Version Negotiation

## 1. Supported Agent Protocols

ProjectMind classifies adapter communication into seven protocol categories:

| Protocol | Category | Primary Transport | Target Agents |
|---|---|---|---|
| `CANONICAL` | Standard Internal | Direct TypeScript / In-Process | Core runtime, test harnesses, internal tools |
| `MCP` | Model Context Protocol | JSON-RPC 2.0 (stdio / SSE) | Claude Desktop, Claude Code, Cursor MCP clients |
| `CLI` | Command-Line Interface | Stdout / JSON / Arguments | Terminal coding agents (Aider, Claude Code, OpenCode) |
| `IDE` | IDE Extension Interface | JSON-RPC / Language Server Protocol | Cursor, VS Code extension, Windsurf, JetBrains |
| `HTTP` | RESTful API | HTTP POST / SSE Streams | Web-based agents, remote agent orchestrators |
| `WEBSOCKET`| Bidirectional Streaming | WebSocket JSON Frames | Live paired programming agents, real-time IDE sync |
| `CUSTOM` | User-Defined Extension | Pluggable / Custom Transport | Proprietary enterprise coding agent frameworks |

---

## 2. Semantic Version Negotiation

ProjectMind implements semantic version negotiation via `AgentProtocolVersion`:

### Parsing Format
Versions follow semantic conventions (`major.minor.patch` or `major.minor`):
- `1.0` -> `{ major: 1, minor: 0, patch: 0 }`
- `2.1.4` -> `{ major: 2, minor: 1, patch: 4 }`
- Non-numeric or invalid formats return `undefined`.

### Compatibility Rules
1. **Major Version Lock**: Breaking changes increment the major version. Adapters supporting protocol `1.x` cannot process `2.x` requests.
2. **Minor Backward Compatibility**: A request specifying minor version `M_req` is compatible with adapter supporting `M_sup` if `M_req <= M_sup`.
3. **Capability Negotiation**: When a client requests specific capabilities alongside a protocol version, `AgentCapabilityMapper.assessCompatibility` returns:
   - `FULL`: All requested capabilities are natively supported and protocol versions are compatible.
   - `PARTIAL`: Protocol version is compatible, but some optional capabilities are unsupported.
   - `DEGRADED`: Critical capabilities are missing, but fallback translation exists.
   - `INCOMPATIBLE`: Major protocol version mismatch.
   - `UNSUPPORTED`: Zero requested capabilities are supported by the selected adapter.

---

## 3. Protocol Request/Response Envelope Lifecycle

```
[External Client]
       │  (Native Protocol Request)
       ▼
[IAgentAdapter.translateRequest]
       │
       ▼
[AdapterRequest]
  ├── requestId: string
  ├── adapterId: string
  ├── protocol: AgentProtocol
  ├── protocolVersion: string
  ├── operation: AgentOperationType
  ├── agentId: string
  ├── sessionId?: string
  ├── workspaceContext: { workspaceId, repositoryId }
  └── payload: unknown
       │
       ▼
[AgentProtocolTranslator.toCanonicalRequest]
       │
       ▼
[AgentRequest] (Canonical ProjectMind Request dispatched to AgentPipeline)
       │
       ▼
[AgentResponse] (Canonical ProjectMind Response)
       │
       ▼
[AgentProtocolTranslator.fromCanonicalResponse]
       │
       ▼
[AdapterResponse]
  ├── requestId: string
  ├── adapterId: string
  ├── status: 'SUCCESS' | 'ERROR' | 'PARTIAL'
  ├── data?: unknown
  ├── error?: AdapterError
  ├── warnings: readonly string[]
  └── metadata: AdapterResponseMetadata
       │
       ▼
[IAgentAdapter.translateResponse]
       │  (Native Protocol Response)
       ▼
[External Client]
```
