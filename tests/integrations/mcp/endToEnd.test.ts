import { describe, it, expect, afterEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryMcpTransport } from '../../../src/integrations/mcp/transport/InMemoryMcpTransport.js';
import { createMockMcpHarness } from './McpTestHelper.js';
import type { ProjectMindMcpServer } from '../../../src/integrations/mcp/server/ProjectMindMcpServer.js';

describe('MCP End-to-End Client/Server Integration', () => {
  let server: ProjectMindMcpServer;
  let client: Client;

  afterEach(async () => {
    if (client) {
      try {
        await client.close();
      } catch {
        // Ignore
      }
    }
    if (server) {
      try {
        await server.stop();
      } catch {
        // Ignore
      }
    }
  });

  it('connects official MCP SDK Client to ProjectMindMcpServer and lists tools', async () => {
    const harness = await createMockMcpHarness();
    server = harness.server;

    const [serverTransport, clientTransport] = InMemoryMcpTransport.createLinkedPair();

    client = new Client(
      {
        name: 'claude-desktop-test',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    await server.start(serverTransport);
    await client.connect(clientTransport);

    const toolsResult = await client.listTools();
    expect(toolsResult.tools).toBeDefined();
    expect(toolsResult.tools.length).toBe(36);


    const names = toolsResult.tools.map((t) => t.name);
    expect(names).toContain('projectmind_get_context');
    expect(names).toContain('projectmind_get_feature');
    expect(names).toContain('projectmind_get_impact');
    expect(names).toContain('projectmind_report_execution');
  });

  it('invokes canonical tools through client.callTool and receives text results', async () => {
    const harness = await createMockMcpHarness();
    server = harness.server;

    const [serverTransport, clientTransport] = InMemoryMcpTransport.createLinkedPair();

    client = new Client(
      {
        name: 'cursor-ide-test',
        version: '0.40.0',
      },
      {
        capabilities: {},
      }
    );

    await server.start(serverTransport);
    await client.connect(clientTransport);

    // Call projectmind_get_context
    const contextResult = (await client.callTool({
      name: 'projectmind_get_context',
      arguments: {
        taskId: 'task-e2e-001',
      },
    })) as any;

    expect(contextResult.isError).toBeFalsy();
    expect(contextResult.content).toHaveLength(1);
    expect(contextResult.content[0].type).toBe('text');

    const parsedContext = JSON.parse(contextResult.content[0].text);
    expect(parsedContext).toBeDefined();

    // Call projectmind_get_feature
    const featureResult = (await client.callTool({
      name: 'projectmind_get_feature',
      arguments: {
        featureId: 'feat-auth-01',
      },
    })) as any;

    expect(featureResult.isError).toBeFalsy();
    expect(featureResult.content[0].type).toBe('text');
    const parsedFeature = JSON.parse(featureResult.content[0].text);
    expect(parsedFeature.found).toBe(true);
    expect(parsedFeature.feature?.profile?.featureId).toBe('feat-auth-01');
  });

  it('returns isError: true when client invokes unknown or invalid tool', async () => {
    const harness = await createMockMcpHarness();
    server = harness.server;

    const [serverTransport, clientTransport] = InMemoryMcpTransport.createLinkedPair();

    client = new Client(
      {
        name: 'test-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    await server.start(serverTransport);
    await client.connect(clientTransport);

    const result = (await client.callTool({
      name: 'non_existent_tool',
      arguments: {},
    })) as any;

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('[Error TOOL_NOT_FOUND]');
  });
});
