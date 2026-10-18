import { describe, it, expect } from 'vitest';
import { createCanonicalToolRegistry } from '../../../src/agent/protocol/registry/ToolManifest.js';
import type { ToolDiscoveryResponse } from '../../../src/agent/protocol/models/ToolDiscoveryResponse.js';

describe('Tool Discovery Protocol', () => {
  it('publishes full canonical tool catalog for unrestricted agent', () => {
    const registry = createCanonicalToolRegistry();
    const discovery: ToolDiscoveryResponse = registry.getDiscoveryInfo();

    expect(discovery.protocolVersion).toBe('1.0');
    expect(discovery.totalTools).toBe(36);
    expect(discovery.tools).toHaveLength(36);


    const toolNames = discovery.tools.map((t) => t.name);
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
  });

  it('filters discovery items strictly by agent capability list', () => {
    const registry = createCanonicalToolRegistry();

    // Agent with only FEATURE_QUERY and HEALTH_QUERY
    const discovery = registry.getDiscoveryInfo(['FEATURE_QUERY', 'HEALTH_QUERY']);

    const exposedToolNames = discovery.tools.map((t) => t.name);
    expect(exposedToolNames).toContain('projectmind_get_feature');
    expect(exposedToolNames).toContain('projectmind_get_health');
    expect(exposedToolNames).not.toContain('projectmind_get_context');
    expect(exposedToolNames).not.toContain('projectmind_report_execution');
  });

  it('ensures each discovery tool includes complete schemas and descriptions', () => {
    const registry = createCanonicalToolRegistry();
    const discovery = registry.getDiscoveryInfo();

    for (const tool of discovery.tools) {
      expect(tool.name).toBeDefined();
      expect(tool.description.length).toBeGreaterThan(10);
      expect(tool.category).toBeDefined();
      expect(tool.safetyLevel).toBeDefined();
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.outputSchema).toBeDefined();
      expect(tool.outputSchema.type).toBe('object');
    }
  });
});
