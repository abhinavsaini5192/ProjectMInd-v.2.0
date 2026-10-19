# ProjectMind — Antigravity MCP Integration Guide

This guide documents the implementation, architecture, configuration, and verification of the ProjectMind Model Context Protocol (MCP) server for integration with **Google Antigravity**.

---

## 1. Architecture & Design Principles

The ProjectMind MCP server exposes canonical repository intelligence to AI assistants via the standard Model Context Protocol (MCP) using `@modelcontextprotocol/sdk`.

### Core Architectural Guarantees:
1. **Thin Adapter Pattern**: The MCP layer does not implement parallel retrieval, indexing, or parsing. It delegates all operations directly to ProjectMind's canonical engines: `HybridRetrievalEngine`, `SemanticIndex`, `LocalSemanticEmbeddingProvider`, and `SemanticChunker`.
2. **Standard Stdio Transport**: Communicates via standard JSON-RPC 2.0 over `stdin` and `stdout`.
3. **Stdout Stream Integrity**: The standard output channel is strictly reserved for valid JSON-RPC frames. All diagnostic logging, telemetry, and platform notices are routed to `stderr` to prevent protocol corruption.
4. **Deterministic Local Operation**: All intelligence operations run deterministically without requiring external API keys, cloud subscriptions, or local Ollama instances.
5. **Read-Only Safety**: The MCP adapter provides read-only repository intelligence. It does not execute shell commands, edit files, compile code, or perform arbitrary system calls.
6. **Strict Security Boundaries**:
   - Explicit `projectPath` parameter with normalization (`path.resolve`).
   - Path traversal prevention (`..` checks and root boundary verification).
   - Prompt injection defense scanning (`SecuritySanitizer.checkPromptInjection`).
   - Automated secret redaction on all tool outputs (`SecuritySanitizer.redactSecrets`).

---

## 2. Available MCP Tools

ProjectMind exposes four core repository-intelligence tools:

### 1. `projectmind_get_context`
Generates an optimized, token-budgeted context package for a specific coding or debugging task.
- **Inputs**:
  - `projectPath` (string, required): Absolute path to the repository.
  - `task` (string, required): Developer task description.
  - `maxFiles` (integer, optional, default: 5, max: 20): Maximum relevant files to include.
- **Output**:
  - Selected files with relevance scores.
  - Extracted code symbols and declaration signatures.
  - Selection rationale explaining why each file is relevant to the task.
  - Estimated token consumption and metadata.

### 2. `projectmind_search`
Performs hybrid semantic and lexical search across the repository index.
- **Inputs**:
  - `projectPath` (string, required): Absolute path to the repository.
  - `query` (string, required): Search query or symbol name.
  - `limit` (integer, optional, default: 10, max: 50): Maximum result count.
- **Output**:
  - Ranked matching files and symbols.
  - Code snippets and line locations.
  - Relevance confidence scores.

### 3. `projectmind_explain_feature`
Explains how a feature or subsystem is implemented using verified codebase evidence.
- **Inputs**:
  - `projectPath` (string, required): Absolute path to the repository.
  - `feature` (string, required): Name or description of the feature/subsystem.
- **Output**:
  - Architectural overview grounded in actual files.
  - Primary entry points and implementation files.
  - Discovered types, classes, functions, and key declarations.
  - Verified source references.

### 4. `projectmind_impact_analysis`
Analyzes reverse dependencies and calculates the potential blast radius of changing a file or symbol.
- **Inputs**:
  - `projectPath` (string, required): Absolute path to the repository.
  - `target` (string, required): Relative file path or symbol name to analyze.
  - `changeDescription` (string, optional): Contextual description of the proposed change.
- **Output**:
  - Target file verification and size.
  - Direct dependent files importing or referencing the target.
  - Blast radius assessment (`LOW`, `MEDIUM`, `HIGH`).
  - Known dependency links and impact summary.

---

## 3. Google Antigravity Configuration

Antigravity manages external MCP servers using its central configuration file.

### Configuration File Location:
```text
C:\Users\Mummy\.gemini\config\mcp_config.json
```

### Server Configuration Schema:
Add the `projectmind` server entry under `mcpServers`:

```json
{
  "mcpServers": {
    "projectmind": {
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args": [
        "c:\\Users\\Mummy\\Desktop\\bakwas\\ProjectMind\\dist\\integrations\\mcp\\server\\main.js"
      ],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

> **Note**: Always use double backslashes (`\\`) in Windows paths within JSON configuration files.

---

## 4. Building and Running

### Build the MCP Server
Compile the TypeScript source to production JavaScript and normalize ESM specifiers:
```bash
npm run build
```
Compiled server entry point:
```text
c:\Users\Mummy\Desktop\bakwas\ProjectMind\dist\integrations\mcp\server\main.js
```

### Run Automated Unit & Integration Tests
Execute the MCP test suite:
```bash
npx vitest run tests/integrations/mcp
```

### Run Live Stdio Verification
Verify the server using a real MCP client over stdio:
```bash
node scripts/verify-mcp-stdio.mjs
```

---

## 5. Verification Checklist

| Check | Expected Result | Status |
|---|---|---|
| Server Stdio Boot | Responds to MCP JSON-RPC `initialize` handshake | Verified |
| Tool Discovery | Returns `projectmind_get_context`, `projectmind_search`, `projectmind_explain_feature`, `projectmind_impact_analysis` | Verified |
| Path Normalization | Resolves relative/absolute paths correctly | Verified |
| Traversal Protection | Rejects `..` path escape attempts with actionable error | Verified |
| Prompt Injection | Flags prompt injection payloads in task inputs | Verified |
| Secret Redaction | Automatically masks API keys, secrets, and bearer tokens | Verified |
| Clean Exit | Closes child processes and releases resources on `stdin` close / SIGINT | Verified |
