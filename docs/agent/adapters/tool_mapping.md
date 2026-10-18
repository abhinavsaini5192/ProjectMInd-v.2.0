# ProjectMind Agent Adapters — Tool Mapping

## 1. Tool Mapping Architecture

ProjectMind defines tools canonically as `AgentTool` (Phase 7.2 Tool Protocol). An `AgentTool` includes:
- `toolId`, `name`, `description`, `version`
- `category` (`CONTEXT`, `FEATURE`, `IMPACT`, `HEALTH`, `VERIFICATION`, `OBSERVATION`, `EXECUTION`)
- `operation` (`AgentOperationType`)
- `inputSchema` (JSON schema object with properties and required list)
- `outputSchema`
- `requiredCapabilities`
- `safetyLevel` (`READ_ONLY`, `MUTATION_LOCAL`, `MUTATION_GLOBAL`)
- `idempotent` & `retryable` flags

The `AgentToolMapper` translates these canonical definitions into the exact schemas required by external LLM providers.

---

## 2. Provider Tool Schemas

### OpenAI / Copilot Function Calling
```json
{
  "type": "function",
  "function": {
    "name": "projectmind_get_context",
    "description": "Retrieve compact repository context for a task",
    "parameters": {
      "type": "object",
      "properties": {
        "taskText": { "type": "string", "description": "The task description" }
      },
      "required": ["taskText"]
    }
  }
}
```

### Anthropic / Claude Code Tool Calling
```json
{
  "name": "projectmind_get_context",
  "description": "Retrieve compact repository context for a task",
  "input_schema": {
    "type": "object",
    "properties": {
      "taskText": { "type": "string", "description": "The task description" }
    },
    "required": ["taskText"]
  }
}
```

### Cursor / Windsurf IDE Format
```json
{
  "id": "tool_get_context",
  "name": "projectmind_get_context",
  "description": "Retrieve compact repository context for a task",
  "category": "CONTEXT",
  "readOnly": true,
  "parameters": { ... }
}
```

### Model Context Protocol (MCP)
```json
{
  "name": "projectmind_get_context",
  "description": "Retrieve compact repository context for a task",
  "inputSchema": { ... }
}
```

---

## 3. Dynamic Tool Translation via Pipelines

When external agents query available tools, ProjectMind:
1. Discovers active, enabled tools from `IAgentToolRegistry`.
2. Filters tools based on adapter capabilities and safety levels.
3. Maps each tool via `AgentToolMapper.mapToolToProviderSchema`.
4. Returns the schema array formatted for the requesting provider.
