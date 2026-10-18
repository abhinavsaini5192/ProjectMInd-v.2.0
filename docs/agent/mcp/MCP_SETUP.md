# MCP Integration & Setup Guide

This guide describes how to configure external AI coding assistants to connect to the ProjectMind MCP Server.

---

## 1. Quickstart via CLI

You can run the ProjectMind MCP Server directly over standard I/O:

```bash
# Using Node directly
node dist/integrations/mcp/server/main.js --workspace /path/to/project --repo my-repo

# Using environment variables
PROJECTMIND_WORKSPACE_ID=/path/to/project PROJECTMIND_REPOSITORY_ID=my-repo node dist/integrations/mcp/server/main.js
```

---

## 2. Claude Desktop Integration

Add ProjectMind to your Claude Desktop configuration (`claude_desktop_config.json`):

### macOS:
`~/Library/Application Support/Claude/claude_desktop_config.json`

### Windows:
`%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "projectmind": {
      "command": "node",
      "args": [
        "C:\\path\\to\\ProjectMind\\dist\\integrations\\mcp\\server\\main.js",
        "--workspace",
        "C:\\Users\\Developer\\Projects\\MyRepo",
        "--repo",
        "my-repo-id"
      ]
    }
  }
}
```

---

## 3. Cursor Integration

In Cursor:
1. Go to **Settings** > **Cursor Settings** > **Features** > **MCP Servers**.
2. Click **+ Add New MCP Server**.
3. Choose **Type**: `command` (stdio).
4. **Name**: `projectmind`
5. **Command**:
   ```bash
   node /path/to/ProjectMind/dist/integrations/mcp/server/main.js --workspace ${workspaceFolder} --repo my-repo
   ```

---

## 4. Windsurf Integration

In Windsurf, configure your `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "projectmind": {
      "command": "node",
      "args": [
        "/path/to/ProjectMind/dist/integrations/mcp/server/main.js",
        "--workspace",
        "/workspace/path",
        "--repo",
        "repo-id"
      ]
    }
  }
}
```

---

## 5. Verification

Once connected, your AI assistant will have access to the 12 `projectmind_*` tools:
- Ask: *"What is the context for task authentication-flow?"*
- The AI assistant will invoke `projectmind_get_context` and retrieve pre-filtered, budget-optimized context.
