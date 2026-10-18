# ProjectMind Agent Adapters — Providers & Extensibility

## 1. Supported Agent Providers

ProjectMind categorizes external agent providers into the following canonical types:

| Provider | Target Agent Framework | Key Protocol & Features |
|---|---|---|
| `GENERIC` | Reference Implementation | Canonical protocol, comprehensive testing, reference behaviors |
| `ANTHROPIC` | Claude API / Direct Claude Use | Anthropic tool calling schema, structured XML context |
| `CLAUDE_CODE` | Claude Code CLI Tool | Terminal interaction, compact markdown prompts, tool results |
| `OPENAI` | ChatGPT / Assistants API / Codex | OpenAI Function Calling format, JSON schema validation |
| `CURSOR` | Cursor AI IDE | IDE editor state awareness, diff buffers, read-only tool flags |
| `WINDSURF` | Windsurf / Codeium IDE | IDE context, cascade tool patterns, real-time code actions |
| `AIDER` | Aider CLI Assistant | Terminal git-focused prompts, unified search/replace diff formats |
| `COPILOT` | GitHub Copilot | Language server chat context, inline completions |
| `CUSTOM` | Proprietary Enterprise Agents | Specialized schemas and customized multi-agent setups |

---

## 2. Implementing a Provider Adapter

Every provider adapter implements `IAgentAdapter` from `src/agent/adapters/interfaces/IAgentAdapter.ts`.

### Checklist for Provider Adapters

1. **Metadata Declaration**:
   - Provide a unique `adapterId` (e.g., `claude_code_adapter`).
   - Specify accurate `provider` (`CLAUDE_CODE`) and `protocol` (`CLI`).
   - Declare the exact array of `capabilities` supported.
   - Define limits (`maxRequestSizeBytes`, `maxResponseSizeBytes`).

2. **Request Normalization**:
   - Implement `translateRequest(rawRequest)`.
   - Extract `workspaceContext` (`workspaceId` and `repositoryId`).
   - Extract or assign `requestId`.
   - Normalize target operation (defaulting to `GET_CONTEXT`).

3. **Response Translation**:
   - Implement `translateResponse(canonicalResponse, requestEnvelope)`.
   - Wrap canonical data in the format expected by the provider.
   - Map errors cleanly without leaking internal stack traces.

4. **Tool & Context Translation**:
   - Use `AgentToolMapper` to emit OpenAI function schemas or Anthropic tool schemas.
   - Use `AgentContextMapper` to emit Markdown, JSON, XML, or RAW representations.

5. **Session Management**:
   - Use `AgentSessionMapper` to correlate provider session IDs with ProjectMind's canonical session IDs.

---

## 3. Extensibility & Registration Example

```typescript
import { AgentAdapterRegistry, IAgentAdapter } from 'projectmind/agent/adapters';

class CustomEnterpriseAdapter implements IAgentAdapter {
  // Implementation...
}

const registry = container.resolve(AgentAdapterTokens.IAgentAdapterRegistry);
registry.register(new CustomEnterpriseAdapter());
```
