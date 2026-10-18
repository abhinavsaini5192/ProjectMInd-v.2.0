# Model Context Protocol (MCP) Architecture

## 1. Overview & Purpose

The **ProjectMind MCP Interface** provides an external, standards-compliant Model Context Protocol interface that allows modern AI coding agents (Claude Desktop, Cursor, Windsurf, CLI agents, etc.) to discover and invoke ProjectMind repository intelligence and context capabilities.

ProjectMind sits between AI coding agents and software repositories as an AI-native repository memory and context optimization platform. The MCP layer acts strictly as a **transport and adapter interface** that bridges the standard Model Context Protocol to ProjectMind's canonical agent tool protocol.

```
┌────────────────────────────────────────────────────────┐
│                   External AI Client                   │
│         (Claude Desktop, Cursor, Windsurf, CLI)        │
└───────────────────────────┬────────────────────────────┘
                            │ JSON-RPC 2.0 (MCP)
                            ▼
┌────────────────────────────────────────────────────────┐
│                   MCP Transport Layer                  │
│        (StdioServerTransport / InMemoryTransport)      │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│             ProjectMind MCP Server (Coordinator)       │
│           • Declares only { tools: {} } capability     │
│           • Request lifecycle & telemetry tracking     │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│                     McpToolAdapter                     │
│         • Dynamic schema translation (Draft-7)         │
│         • Security sanitization & argument validation  │
│         • Session & caller identity mapping            │
└───────────────────────────┬────────────────────────────┘
                            │ Canonical ToolRequest
                            ▼
┌────────────────────────────────────────────────────────┐
│        AgentToolPipeline (Canonical Tool Protocol)     │
│         • Envelope validation & idempotency manager    │
│         • Capability & scope authorization             │
│         • Tool execution & error normalization         │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│                   ProjectMind Core Services            │
│   (Context Orchestrator, Feature Knowledge API, etc.) │
└────────────────────────────────────────────────────────┘
```

---

## 2. Architectural Boundaries & Non-Negotiable Rules

1. **No Duplicate Tool Semantics**:
   The MCP layer does not define tool schemas or execution semantics independently. All 12 tools are dynamically retrieved from `IAgentToolRegistry.listTools()`.

2. **No Core Engines in MCP Layer**:
   The MCP layer does not parse ASTs, scan repositories, execute Git operations, build dependency graphs, or compute token budgets. It delegates all operations through `IAgentToolPipeline`.

3. **Strict Capability Declaration**:
   The MCP server strictly declares `{ tools: {} }` capability. It does not advertise prompts, resources, or sampling capabilities.

4. **Safety Classifications**:
   All exposed tools are strictly `READ_ONLY` or `REPORT_ONLY`. No arbitrary shell execution, file modification, or compilation commands are permitted.

5. **Data vs Policy Separation**:
   Repository code returned in tool results is treated strictly as data and wrapped with security tags (`<repository-data>`) to prevent context poisoning.
