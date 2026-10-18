import { describe, it, expect } from 'vitest';
import { createMockMcpHarness } from './McpTestHelper.js';

describe('McpToolAdapter', () => {
  it('dynamically discovers all 36 canonical tools from the tool registry', async () => {
    const { toolAdapter } = await createMockMcpHarness();
    const tools = await toolAdapter.listTools();

    expect(tools.length).toBe(36);


    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toContain('projectmind_get_context');
    expect(toolNames).toContain('projectmind_get_feature');
    expect(toolNames).toContain('projectmind_get_feature_context');
    expect(toolNames).toContain('projectmind_get_impact');
    expect(toolNames).toContain('projectmind_get_architecture');
    expect(toolNames).toContain('projectmind_get_history');
    expect(toolNames).toContain('projectmind_get_health');
    expect(toolNames).toContain('projectmind_explain_context');
    expect(toolNames).toContain('projectmind_refresh_context');
    expect(toolNames).toContain('projectmind_report_execution');
    expect(toolNames).toContain('projectmind_report_verification');
    expect(toolNames).toContain('projectmind_update_knowledge');
    expect(toolNames).toContain('projectmind_start_task_context');
    expect(toolNames).toContain('projectmind_get_current_context');
  });

  it('provides non-empty descriptions and valid inputSchema objects for each tool', async () => {
    const { toolAdapter } = await createMockMcpHarness();
    const tools = await toolAdapter.listTools();

    for (const tool of tools) {
      expect(tool.name).toMatch(/^projectmind_[a-z_]+$/);
      expect(tool.description.length).toBeGreaterThan(10);
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.inputSchema.properties).toBeDefined();
    }
  });

  it('filters out disabled or unregistered tools dynamically', async () => {
    const harness = await createMockMcpHarness();
    const registry = harness.pipeline.getRegistry();

    // 1. Check initial count
    const initialTools = await harness.toolAdapter.listTools();
    expect(initialTools.length).toBe(36);


    // 2. Disable a tool by updating it with enabled: false
    const existingTool = registry.getTool('projectmind_get_health')!;
    registry.unregisterTool('projectmind_get_health');
    registry.registerTool({
      ...existingTool,
      enabled: false,
    });

    const updatedTools = await harness.toolAdapter.listTools();
    expect(updatedTools.length).toBe(35);
    expect(updatedTools.find((t) => t.name === 'projectmind_get_health')).toBeUndefined();

    // 3. Unregister a tool
    registry.unregisterTool('projectmind_get_history');
    const remainingTools = await harness.toolAdapter.listTools();
    expect(remainingTools.length).toBe(34);

    expect(remainingTools.find((t) => t.name === 'projectmind_get_history')).toBeUndefined();
  });
});
