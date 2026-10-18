import { describe, it, expect } from 'vitest';
import { CANONICAL_TOOLS } from '../../../src/agent/protocol/registry/ToolManifest.js';

describe('Phase 7.2 Architectural Boundaries & Non-Goals Invariants', () => {
  it('strictly restricts tool safety levels to READ_ONLY or REPORT_ONLY', () => {
    for (const tool of CANONICAL_TOOLS) {
      expect(['READ_ONLY', 'REPORT_ONLY']).toContain(tool.safetyLevel);
      expect(tool.safetyLevel).not.toBe('CONTROLLED_WRITE');
    }
  });

  it('guarantees provider-neutral tool names and schemas without provider-specific syntax', () => {
    for (const tool of CANONICAL_TOOLS) {
      // Must start with canonical projectmind_ prefix
      expect(tool.name.startsWith('projectmind_')).toBe(true);

      // Must not reference specific AI models or vendor protocols in names or descriptions
      const serialized = JSON.stringify(tool).toLowerCase();
      expect(serialized).not.toContain('anthropic');
      expect(serialized).not.toContain('openai');
      expect(serialized).not.toContain('gemini');
      expect(serialized).not.toContain('claude');
      expect(serialized).not.toContain('mcp');
    }
  });

  it('does not expose autonomous execution, shell commands, or arbitrary code execution', () => {
    for (const tool of CANONICAL_TOOLS) {
      const keys = Object.keys(tool.inputSchema.properties);
      expect(keys).not.toContain('exec');
      expect(keys).not.toContain('shell');
      expect(keys).not.toContain('command');
      expect(keys).not.toContain('eval');
    }
  });

  it('verifies that all tools require either WORKSPACE_REQUIRED or SESSION_REQUIRED scope', () => {
    for (const tool of CANONICAL_TOOLS) {
      expect(['WORKSPACE_REQUIRED', 'SESSION_REQUIRED']).toContain(tool.requiredScope);
    }
  });
});
