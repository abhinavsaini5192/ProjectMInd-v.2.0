import { describe, it, expect } from 'vitest';
import { ToolSafetyValidator } from '../../../src/agent/protocol/validation/ToolSafetyValidator.js';
import { ToolArgumentError } from '../../../src/agent/protocol/errors/ToolArgumentError.js';
import { ToolPayloadTooLargeError } from '../../../src/agent/protocol/errors/ToolPayloadTooLargeError.js';
import { createToolPipeline } from '../../../src/agent/protocol/di/ToolDISetup.js';
import { createMockToolDependencies, createMockToolRequest } from './ToolTestHelper.js';

describe('Tool Safety & Security Validation', () => {
  it('detects and rejects dangerous execution command keys in arguments', () => {
    const dangerousArgs = [
      { exec: 'rm -rf /' },
      { eval: 'process.exit(1)' },
      { spawn: 'sh' },
      { shellCommand: 'cat /etc/passwd' },
      { child_process: true },
      { nested: { exec: 'calc.exe' } },
    ];

    for (const args of dangerousArgs) {
      expect(() => ToolSafetyValidator.validate(args, 'test_tool')).toThrow(
        ToolArgumentError
      );
      expect(() => ToolSafetyValidator.validate(args, 'test_tool')).toThrow(
        /Security violation: forbidden argument key/
      );
    }
  });

  it('detects and rejects path traversal attempts in argument strings', () => {
    const traversalArgs = [
      { path: '../../../etc/passwd' },
      { file: '..\\..\\windows\\system32' },
      { file: '%2e%2e/secret.key' },
      { file: 'file\0.txt' },
      { files: ['src/index.ts', '../../sensitive.env'] },
    ];

    for (const args of traversalArgs) {
      expect(() => ToolSafetyValidator.validate(args, 'test_tool')).toThrow(
        ToolArgumentError
      );
      expect(() => ToolSafetyValidator.validate(args, 'test_tool')).toThrow(
        /Security violation: directory traversal/
      );
    }
  });

  it('rejects oversized payloads exceeding max payload size', () => {
    const largeString = 'x'.repeat(100 * 1024); // 100KB
    const args = { data: largeString };

    // Set max payload to 50KB
    expect(() =>
      ToolSafetyValidator.validate(args, 'test_tool', 50 * 1024)
    ).toThrow(ToolPayloadTooLargeError);

    // Set max payload to 200KB - passes
    expect(() =>
      ToolSafetyValidator.validate(args, 'test_tool', 200 * 1024)
    ).not.toThrow();
  });

  it('integrates with AgentToolPipeline to reject security violations at the boundary', async () => {
    const deps = createMockToolDependencies();
    const pipeline = createToolPipeline(deps);

    const maliciousRequest = createMockToolRequest({
      toolName: 'projectmind_get_context',
      arguments: {
        taskId: 'task-1',
        targetFiles: ['../../../../secret.env'],
      },
    });

    const response = await pipeline.execute(maliciousRequest);

    expect(response.success).toBe(false);
    expect(response.error?.code).toBe('TOOL_ARGUMENT_INVALID');
    expect(response.error?.message).toContain('directory traversal');
  });
});
