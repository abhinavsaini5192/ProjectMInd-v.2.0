# Tool Protocol Adapter Guide (Phase 7.2)

This guide documents how provider-specific tool invocation mechanisms (such as Anthropic Claude, OpenAI Function Calling, and Model Context Protocol) map cleanly into the canonical ProjectMind Agent Tool Protocol.

---

## 1. Mapping Overview

```
Provider Format                                 ProjectMind Canonical
┌───────────────────────────┐                   ┌───────────────────────────┐
│ MCP CallToolRequest       │                   │ ToolRequest               │
│ - name                    ├──────────────────►│ - toolName                │
│ - arguments               │                   │ - arguments               │
│ - _meta.requestId         │                   │ - requestId               │
└───────────────────────────┘                   └─────────────┬─────────────┘
                                                              │
┌───────────────────────────┐                                 │
│ OpenAI Function Call      │                                 │
│ - name                    ├─────────────────────────────────┤
│ - arguments (JSON string) │                                 │
└───────────────────────────┘                                 ▼
                                                ┌───────────────────────────┐
┌───────────────────────────┐                   │ AgentToolPipeline         │
│ Anthropic Tool Use        │                   │ (Unified Validation &     │
│ - name                    ├──────────────────►│  Execution)               │
│ - input                   │                   └─────────────┬─────────────┘
└───────────────────────────┘                                 │
                                                              ▼
                                                ┌───────────────────────────┐
                                                │ ToolResponse              │
                                                │ - success: boolean        │
                                                │ - result: unknown         │
                                                │ - error?: ToolError       │
                                                └───────────────────────────┘
```

---

## 2. Model Context Protocol (MCP) Mapping

### Input Translation
```typescript
function mapMcpToToolRequest(mcpRequest: any, context: { workspaceId: string; repositoryId: string; agentId: string }): ToolRequest {
  return {
    requestId: mcpRequest.params._meta?.requestId ?? `req_${Date.now()}`,
    protocolVersion: '1.0',
    toolName: mcpRequest.params.name,
    arguments: mcpRequest.params.arguments ?? {},
    workspaceId: context.workspaceId,
    repositoryId: context.repositoryId,
    agentId: context.agentId,
    timestamp: new Date().toISOString(),
  };
}
```

### Output Translation
```typescript
function mapToolResponseToMcp(response: ToolResponse): any {
  if (response.success) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.result, null, 2),
        },
      ],
      isError: false,
    };
  } else {
    return {
      content: [
        {
          type: 'text',
          text: `[${response.error?.code}] ${response.error?.message}`,
        },
      ],
      isError: true,
    };
  }
}
```

---

## 3. Anthropic Claude Tool Use Mapping

Anthropic expects a `tool_use` content block with `name` and `input`:

```typescript
function mapAnthropicToToolRequest(toolUseBlock: { id: string; name: string; input: Record<string, unknown> }, session: AgentSession): ToolRequest {
  return {
    requestId: toolUseBlock.id,
    protocolVersion: '1.0',
    toolName: toolUseBlock.name,
    arguments: toolUseBlock.input,
    workspaceId: session.workspaceId,
    repositoryId: session.repositoryId,
    sessionId: session.sessionId,
    agentId: session.agentId,
    timestamp: new Date().toISOString(),
  };
}
```

---

## 4. OpenAI Function Calling Mapping

OpenAI models output function names and JSON-encoded argument strings:

```typescript
function mapOpenAiToToolRequest(toolCall: { id: string; function: { name: string; arguments: string } }, session: AgentSession): ToolRequest {
  return {
    requestId: toolCall.id,
    protocolVersion: '1.0',
    toolName: toolCall.function.name,
    arguments: JSON.parse(toolCall.function.arguments || '{}'),
    workspaceId: session.workspaceId,
    repositoryId: session.repositoryId,
    sessionId: session.sessionId,
    agentId: session.agentId,
    timestamp: new Date().toISOString(),
  };
}
```
