import { describe, it, expect, beforeEach } from 'vitest';
import { AgentToolRegistry } from '../../../src/agent/protocol/registry/AgentToolRegistry.js';
import {
  CANONICAL_TOOLS,
  createCanonicalToolRegistry,
} from '../../../src/agent/protocol/registry/ToolManifest.js';
import { ToolProtocolError } from '../../../src/agent/protocol/errors/ToolProtocolError.js';
import type { AgentTool } from '../../../src/agent/protocol/models/AgentTool.js';

describe('AgentToolRegistry', () => {
  let registry: AgentToolRegistry;

  beforeEach(() => {
    registry = new AgentToolRegistry();
  });

  it('initializes empty and allows registering valid tools', () => {
    expect(registry.listTools()).toHaveLength(0);

    const tool = CANONICAL_TOOLS[0]!;
    registry.registerTool(tool);

    expect(registry.listTools()).toHaveLength(1);
    expect(registry.getTool(tool.name)).toBeDefined();
    expect(registry.getTool(tool.name)?.name).toBe(tool.name);
  });

  it('rejects duplicate registration of tools with same name', () => {
    const tool = CANONICAL_TOOLS[0]!;
    registry.registerTool(tool);

    expect(() => registry.registerTool(tool)).toThrow(ToolProtocolError);
    expect(() => registry.registerTool(tool)).toThrow(/already registered/);
  });

  it('unregisters tool by name and returns boolean indicator', () => {
    const tool = CANONICAL_TOOLS[0]!;
    registry.registerTool(tool);

    expect(registry.unregisterTool(tool.name)).toBe(true);
    expect(registry.getTool(tool.name)).toBeUndefined();
    expect(registry.unregisterTool('non_existent')).toBe(false);
  });

  it('filters tools by category correctly', () => {
    const canonicalRegistry = createCanonicalToolRegistry();
    const contextTools = canonicalRegistry.getToolsByCategory('CONTEXT');
    const featureTools = canonicalRegistry.getToolsByCategory('FEATURE');

    expect(contextTools.length).toBeGreaterThanOrEqual(3);
    expect(contextTools.every((t) => t.category === 'CONTEXT')).toBe(true);
    expect(featureTools.length).toBeGreaterThanOrEqual(2);
    expect(featureTools.every((t) => t.category === 'FEATURE')).toBe(true);
  });

  it('filters tools by agent capabilities intersection', () => {
    const canonicalRegistry = createCanonicalToolRegistry();

    // With only CONTEXT_REQUEST capability
    const toolsWithContext = canonicalRegistry.getToolsForCapabilities(['CONTEXT_REQUEST']);
    expect(toolsWithContext.map((t) => t.name)).toContain('projectmind_get_context');
    expect(toolsWithContext.map((t) => t.name)).not.toContain('projectmind_get_feature');

    // With CONTEXT_REQUEST and FEATURE_QUERY capabilities
    const toolsWithBoth = canonicalRegistry.getToolsForCapabilities([
      'CONTEXT_REQUEST',
      'FEATURE_QUERY',
    ]);
    expect(toolsWithBoth.map((t) => t.name)).toContain('projectmind_get_context');
    expect(toolsWithBoth.map((t) => t.name)).toContain('projectmind_get_feature');
  });

  it('reports tool availability based on presence and enabled flag', () => {
    const tool = CANONICAL_TOOLS[0]!;
    registry.registerTool(tool);

    expect(registry.isToolAvailable(tool.name)).toBe(true);
    expect(registry.isToolAvailable('unknown_tool')).toBe(false);

    const disabledTool: AgentTool = {
      ...tool,
      name: 'disabled_tool',
      enabled: false,
    };
    registry.registerTool(disabledTool);
    expect(registry.isToolAvailable('disabled_tool')).toBe(false);
  });

  it('validates tool definitions and rejects malformed fields', () => {
    expect(() => registry.registerTool(null as any)).toThrow(ToolProtocolError);
    expect(() =>
      registry.registerTool({ ...CANONICAL_TOOLS[0]!, name: 'invalid-name-with-dashes' })
    ).toThrow(/invalid characters/);
    expect(() =>
      registry.registerTool({ ...CANONICAL_TOOLS[0]!, description: '' })
    ).toThrow(/missing valid description/);
    expect(() =>
      registry.registerTool({ ...CANONICAL_TOOLS[0]!, category: '' as any })
    ).toThrow(/missing valid category/);
  });

  it('generates sanitized discovery manifest with categories and total counts', () => {
    const canonicalRegistry = createCanonicalToolRegistry();
    const discovery = canonicalRegistry.getDiscoveryInfo();

    expect(discovery.protocolVersion).toBe('1.0');
    expect(discovery.totalTools).toBe(36);
    expect(discovery.tools).toHaveLength(36);
    expect(discovery.categories.length).toBeGreaterThan(0);

    const firstTool = discovery.tools[0]!;
    expect(firstTool.name).toBe('projectmind_get_context');
    expect(firstTool.inputSchema).toBeDefined();
    expect(firstTool.outputSchema).toBeDefined();
    expect(firstTool.safetyLevel).toBe('READ_ONLY');
  });

  it('creates canonical registry containing all 36 tools initialized', () => {
    const canonicalRegistry = createCanonicalToolRegistry();
    expect(canonicalRegistry.listTools()).toHaveLength(36);


    const toolNames = canonicalRegistry.listTools().map((t) => t.name);
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
});
