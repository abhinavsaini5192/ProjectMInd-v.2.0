import { describe, it, expect } from 'vitest';
import { createMockMcpHarness } from './McpTestHelper.js';

describe('MCP Request & Response Flow', () => {
  it('executes projectmind_get_context through the adapter and returns MCP text content', async () => {
    const { toolAdapter, defaultSessionContext } = await createMockMcpHarness();

    const result = await toolAdapter.executeTool(
      {
        name: 'projectmind_get_context',
        arguments: {
          taskId: 'task-auth-001',
        },
      },
      defaultSessionContext
    );

    expect(result.isError).toBeUndefined();
    expect(result.content).toBeDefined();
    expect(result.content.length).toBe(1);
    expect(result.content[0]?.type).toBe('text');

    const parsed = JSON.parse(result.content[0]?.text ?? '{}');
    expect(parsed).toBeDefined();
  });

  it('executes projectmind_get_feature through the adapter', async () => {
    const { toolAdapter, defaultSessionContext } = await createMockMcpHarness();

    const result = await toolAdapter.executeTool(
      {
        name: 'projectmind_get_feature',
        arguments: {
          featureId: 'feat-auth-01',
        },
      },
      defaultSessionContext
    );

    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.type).toBe('text');
    const parsed = JSON.parse(result.content[0]?.text ?? '{}');
    expect(parsed.found).toBe(true);
    expect(parsed.feature?.profile?.featureId).toBe('feat-auth-01');
  });

  it('executes projectmind_get_impact through the adapter', async () => {
    const { toolAdapter, defaultSessionContext } = await createMockMcpHarness();

    const result = await toolAdapter.executeTool(
      {
        name: 'projectmind_get_impact',
        arguments: {
          modifiedFiles: ['src/auth/token.ts'],
        },
      },
      defaultSessionContext
    );

    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.type).toBe('text');
    const parsed = JSON.parse(result.content[0]?.text ?? '{}');
    expect(parsed.depth).toBe(2);
    expect(parsed.affectedFeatures).toContain('feature_b');
  });

  it('executes reporting tool projectmind_report_execution', async () => {
    const { toolAdapter, defaultSessionContext } = await createMockMcpHarness();

    const result = await toolAdapter.executeTool(
      {
        name: 'projectmind_report_execution',
        arguments: {
          taskId: 'task-auth-01',
          status: 'COMPLETED',
          summary: 'Updated token verification routines',
          modifiedFiles: ['src/auth/token.ts'],
        },
      },
      defaultSessionContext
    );

    expect(result.isError).toBeUndefined();
    expect(result.content[0]?.type).toBe('text');
    const parsed = JSON.parse(result.content[0]?.text ?? '{}');
    expect(parsed.acknowledged).toBe(true);
    expect(parsed.taskId).toBe('task-auth-01');
  });
});
