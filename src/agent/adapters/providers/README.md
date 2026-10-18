# ProjectMind Provider-Specific Agent Adapters

This directory serves as the home and reference guide for provider-specific agent adapters in ProjectMind.

## Architectural Purpose

ProjectMind is an AI-native repository intelligence and context optimization platform that provides structured repository knowledge and compact context to external AI coding agents.

The **Agent Adapter Layer** translates between ProjectMind's canonical agent contracts and the diverse input/output conventions required by external coding agents:
- **Claude Code** (Anthropic CLI / tool use conventions)
- **Cursor / Windsurf** (IDE JSON-RPC & editor context)
- **Codex / OpenAI Assistants** (OpenAI tool schemas & function calling)
- **Aider** (Git-driven CLI chat and search/replace diff formats)
- **GitHub Copilot** (Language server & completions/chat protocols)

---

## Non-Negotiable Rules for Provider Adapters

1. **Provider Neutrality**: ProjectMind core (`kernel`, `intelligence`, `context`, `tasks`, `observation`, `verification`) must remain 100% provider-agnostic. No provider-specific imports or data structures are allowed inside the core.
2. **Zero Core Contamination**: All provider quirks, schema translations, and formatting differences must be completely contained within the adapter.
3. **No Duplicate Intelligence**: Adapters MUST NEVER scan the repository, parse code, compute dependencies, rank features, or evaluate repository health. Adapters only *translate*.
4. **Anti-Elevation of Trust**: External agent claims of correctness or verification must remain flagged as `AGENT_REPORTED`. Adapters cannot elevate external claims into kernel-verified facts.
5. **Fail-Isolation**: An error or crash inside an adapter must be caught and returned as a structured error response. It must never corrupt the canonical runtime or crash the host process.

---

## Creating a New Provider Adapter

To implement a new provider adapter:

1. Implement the `IAgentAdapter` interface from `../interfaces/IAgentAdapter.js`.
2. Define accurate `AdapterMetadata`:
   - `id`: unique identifier (e.g. `claude_code_adapter`, `cursor_ide_adapter`)
   - `provider`: one of `AgentProvider`
   - `protocol`: one of `AgentProtocol`
   - `supportedCapabilities`: exact array of capabilities supported by the provider
3. Implement `translateRequest(rawRequest)`:
   - Normalize provider-specific requests into canonical `AdapterRequest`.
4. Implement `translateResponse(canonicalResponse, requestEnvelope)`:
   - Convert canonical `AgentResponse` into provider's expected format.
5. Utilize shared utilities:
   - `AgentToolMapper` for converting canonical tool definitions into provider tool schemas (OpenAI functions, Anthropic tool use, etc.).
   - `AgentContextMapper` for translating `ContextPackage` into Markdown, JSON, XML, or YAML without re-ranking.
   - `AgentSessionMapper` for linking provider session IDs to canonical session IDs.
6. Register the adapter in `AgentAdapterRegistry`.

---

## Example: Minimal Provider Adapter

```typescript
import { IAgentAdapter, AdapterMetadata, AdapterRequest, AdapterResponse, AgentTool, ContextPackage } from '../index.js';
import { AgentToolMapper, AgentContextMapper, AgentSessionMapper, AgentCapabilityMapper } from '../core/index.js';

export class ClaudeCodeAdapter implements IAgentAdapter {
  public readonly metadata: AdapterMetadata = {
    id: 'claude_code_adapter',
    name: 'Claude Code Adapter',
    version: '1.0.0',
    protocolVersion: '1.0',
    provider: 'CLAUDE_CODE',
    protocol: 'CLI',
    type: 'PROVIDER',
    supportedCapabilities: [
      'CONTEXT_RETRIEVAL',
      'TOOL_CALLING',
      'STRUCTURED_OUTPUT'
    ],
    targetAgentType: 'CLI_AGENT'
  };

  public status = 'READY';
  private readonly toolMapper = new AgentToolMapper();
  private readonly contextMapper = new AgentContextMapper();

  public async initialize(): Promise<void> {}
  public async shutdown(): Promise<void> {}

  public checkCompatibility(protocolVersion: string) {
    return new AgentCapabilityMapper().assessCompatibility(this.metadata, protocolVersion);
  }

  public async translateRequest(rawRequest: any): Promise<AdapterRequest> {
    return {
      requestId: rawRequest.id ?? `req_${Date.now()}`,
      adapterId: this.metadata.id,
      protocolVersion: '1.0',
      operation: 'GET_CONTEXT',
      workspaceContext: {
        workspaceId: rawRequest.workspaceId,
        repositoryId: rawRequest.repositoryId
      },
      payload: { taskText: rawRequest.prompt },
      timestamp: new Date().toISOString()
    };
  }

  public async translateResponse(canonical: any): Promise<AdapterResponse> {
    return {
      requestId: canonical.requestId,
      status: canonical.status,
      data: { reply: canonical.data?.content ?? '' },
      metadata: {
        adapterId: this.metadata.id,
        provider: 'CLAUDE_CODE',
        protocol: 'CLI',
        durationMs: 0,
        timestamp: Date.now()
      }
    };
  }

  public mapTool(tool: AgentTool) {
    return this.toolMapper.mapToolToProviderSchema(tool, 'CLAUDE_CODE');
  }

  public mapContext(context: ContextPackage) {
    return this.contextMapper.mapContext(context, { format: 'markdown' });
  }

  public async adaptRequest(input: any) { return this.translateRequest(input) as any; }
  public async adaptResponse(response: any) { return (await this.translateResponse(response)).data; }
}
```
