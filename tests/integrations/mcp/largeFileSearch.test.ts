import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ProjectMindRepositoryToolAdapter } from '../../../src/integrations/mcp/adapters/ProjectMindRepositoryToolAdapter.js';

describe('ProjectMindRepositoryToolAdapter — Large File Search & Context', () => {
  let tempDir: string;
  let adapter: ProjectMindRepositoryToolAdapter;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'projectmind-large-search-'));
    adapter = new ProjectMindRepositoryToolAdapter();

    // 1. Create a large service.py (>1,000 lines) with format_firewall_response in the middle
    const serviceLines: string[] = [
      '# Large Core Service',
      'import os',
      'import sys',
      '',
      'class OrchestratorService:',
      '    def __init__(self):',
      '        self.active = True',
      '',
    ];

    // Pad before the function with 800 lines
    for (let i = 0; i < 800; i++) {
      serviceLines.push(`    def helper_operation_${i}(self): return ${i}`);
    }

    serviceLines.push('');
    serviceLines.push('def format_firewall_response(result):');
    serviceLines.push('    """Format a firewall analysis result canonically."""');
    for (let j = 0; j < 50; j++) {
      serviceLines.push(`    step_${j} = process_firewall_step(result, factor=${j})`);
    }
    serviceLines.push('    return {"status": "SUCCESS", "decision": "ALLOW"}');
    serviceLines.push('');

    // Pad after the function with 200 lines
    for (let k = 0; k < 200; k++) {
      serviceLines.push(`def trailing_utility_${k}(): return "util_${k}"`);
    }

    fs.writeFileSync(path.join(tempDir, 'service.py'), serviceLines.join('\n'));

    // 2. Create __init__.py exporting the function
    const initContent = `
from service import format_firewall_response
__all__ = ["format_firewall_response"]
`;
    fs.writeFileSync(path.join(tempDir, '__init__.py'), initContent);

    // 3. Create test_service.py testing the function
    const testContent = `
import pytest
from service import format_firewall_response

def test_format_firewall_response():
    res = {"input": "test"}
    formatted = format_firewall_response(res)
    assert formatted["status"] == "SUCCESS"
`;
    fs.writeFileSync(path.join(tempDir, 'test_service.py'), testContent);
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Cleanup best effort
    }
  });

  it('retrieves the exact implementation in large file ahead of exports and tests', async () => {
    const result = await adapter.executeTool(
      {
        name: 'projectmind_search',
        arguments: {
          projectPath: tempDir,
          query: 'format_firewall_response',
          limit: 5,
        },
      },
      {
        sessionId: 'test_session',
        agentId: 'test_agent',
        workspaceId: tempDir,
        repositoryId: tempDir,
        startedAt: Date.now(),
        lastActiveAt: Date.now(),
      }
    );

    expect(result.isError).toBe(false);
    expect(result.content.length).toBeGreaterThan(0);

    const jsonMatch = result.content[0]!.text.match(/```json\n([\s\S]*?)\n```/);
    expect(jsonMatch).not.toBeNull();
    const payload = JSON.parse(jsonMatch![1]!);

    expect(payload.results.length).toBeGreaterThanOrEqual(1);

    // Top result should be the service.py implementation
    const topResult = payload.results[0]!;
    expect(topResult.resourceId).toBe('service.py');
    expect(topResult.name).toBe('format_firewall_response');
    expect(topResult.startLine).toBeGreaterThan(800);
    expect(topResult.endLine).toBeGreaterThan(topResult.startLine);
    expect(topResult.snippet).toContain('def format_firewall_response(result):');
    expect(topResult.existsOnDisk).toBe(true);
    expect(topResult.fullPath).toBe(path.resolve(tempDir, 'service.py'));
  });

  it('generates context correctly for large file with accurate file path rollup', async () => {
    const result = await adapter.executeTool(
      {
        name: 'projectmind_get_context',
        arguments: {
          projectPath: tempDir,
          task: 'Implement response formatting logic in format_firewall_response',
          maxFiles: 3,
        },
      },
      {
        sessionId: 'test_session',
        agentId: 'test_agent',
        workspaceId: tempDir,
        repositoryId: tempDir,
        startedAt: Date.now(),
        lastActiveAt: Date.now(),
      }
    );

    expect(result.isError).toBe(false);
    const jsonMatch = result.content[0]!.text.match(/```json\n([\s\S]*?)\n```/);
    expect(jsonMatch).not.toBeNull();
    const payload = JSON.parse(jsonMatch![1]!);

    expect(payload.selectedFiles.length).toBeGreaterThanOrEqual(1);
    const serviceFile = payload.selectedFiles.find((f: any) => f.filePath === 'service.py');
    expect(serviceFile).toBeDefined();
    expect(serviceFile.symbols).toContain('format_firewall_response');
  });
});
