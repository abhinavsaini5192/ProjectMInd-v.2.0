import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createMockMcpHarness } from './McpTestHelper.js';

describe('MCP Architectural Boundaries & Hard Constraints', () => {
  it('strictly declares ONLY tools capability on MCP server', async () => {
    const { server } = await createMockMcpHarness();
    const mcpServerInstance = (server as any).mcpServer;

    expect(mcpServerInstance).toBeDefined();
    const capabilities = mcpServerInstance.getCapabilities();

    expect(capabilities.tools).toBeDefined();
    expect((capabilities as any).prompts).toBeUndefined();
    expect((capabilities as any).resources).toBeUndefined();
    expect((capabilities as any).sampling).toBeUndefined();
  });

  it('all canonical tools are strictly READ_ONLY or REPORT_ONLY with no shell execution', async () => {
    const { pipeline } = await createMockMcpHarness();
    const tools = pipeline.getRegistry().listTools();

    expect(tools.length).toBe(36);


    for (const tool of tools) {
      expect(['READ_ONLY', 'REPORT_ONLY']).toContain(tool.safetyLevel);
      expect(tool.name).not.toMatch(/(shell|terminal|bash|run_command|execute_command|write_file|delete)/i);
    }
  });

  it('MCP layer source files do not contain AST parsing or graph DB engines', () => {
    const mcpDir = path.resolve(process.cwd(), 'src/integrations/mcp');

    function checkDir(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          checkDir(fullPath);
        } else if (entry.name.endsWith('.ts')) {
          const content = fs.readFileSync(fullPath, 'utf8');
          expect(content).not.toContain("from 'web-tree-sitter'");
          expect(content).not.toContain("from 'kuzu'");
          expect(content).not.toContain("from 'better-sqlite3'");
          expect(content).not.toContain('TreeSitter');
        }
      }
    }

    checkDir(mcpDir);
  });

  it('all tools exposed to MCP are dynamically derived from canonical tool registry', async () => {
    const { toolAdapter, pipeline } = await createMockMcpHarness();

    const mcpTools = await toolAdapter.listTools();
    const canonicalTools = pipeline.getRegistry().listTools();

    expect(mcpTools.length).toBe(canonicalTools.length);

    const mcpNames = new Set(mcpTools.map((t) => t.name));
    for (const tool of canonicalTools) {
      expect(mcpNames.has(tool.name)).toBe(true);
    }
  });
});
