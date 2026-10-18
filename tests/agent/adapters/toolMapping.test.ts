import { describe, it, expect } from 'vitest';
import { AgentToolMapper } from '../../../src/agent/adapters/core/AgentToolMapper.js';
import type { AgentTool } from '../../../src/agent/protocol/models/AgentTool.js';

describe('AgentToolMapper Unit Tests', () => {
  const mapper = new AgentToolMapper();

  const mockTool: AgentTool = {
    toolId: 'tool_get_context',
    name: 'projectmind_get_context',
    description: 'Retrieve compact repository context for a task',
    category: 'CONTEXT',
    version: '1.0.0',
    operation: 'GET_CONTEXT',
    inputSchema: {
      type: 'object',
      properties: {
        taskText: {
          type: 'string',
          description: 'The task description',
        },
        maxTokens: {
          type: 'number',
          description: 'Max token budget',
        },
      },
      required: ['taskText'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string' },
      },
    },
    requiredCapabilities: ['CONTEXT_REQUEST'],
    requiredScope: 'WORKSPACE_REQUIRED',
    safetyLevel: 'READ_ONLY',
    limits: {
      maxExecutionTimeMs: 15000,
    },
    enabled: true,
    idempotent: true,
    retryable: true,
  };

  it('maps tool to OpenAI function calling format', () => {
    const openAiSchema = mapper.mapToolToProviderSchema(mockTool, 'OPENAI') as any;

    expect(openAiSchema.type).toBe('function');
    expect(openAiSchema.function).toBeDefined();
    expect(openAiSchema.function.name).toBe('projectmind_get_context');
    expect(openAiSchema.function.description).toContain('Retrieve compact repository context');
    expect(openAiSchema.function.parameters.type).toBe('object');
    expect(openAiSchema.function.parameters.properties.taskText).toBeDefined();
    expect(openAiSchema.function.parameters.required).toContain('taskText');
  });

  it('maps tool to Anthropic / Claude Code tool use format', () => {
    const claudeSchema = mapper.mapToolToProviderSchema(mockTool, 'CLAUDE_CODE') as any;

    expect(claudeSchema.name).toBe('projectmind_get_context');
    expect(claudeSchema.description).toContain('Retrieve compact repository context');
    expect(claudeSchema.input_schema).toBeDefined();
    expect(claudeSchema.input_schema.type).toBe('object');
    expect(claudeSchema.input_schema.properties.taskText).toBeDefined();
    expect(claudeSchema.input_schema.required).toContain('taskText');
  });

  it('maps tool to Cursor IDE format with safety level', () => {
    const cursorSchema = mapper.mapToolToProviderSchema(mockTool, 'CURSOR') as any;

    expect(cursorSchema.id).toBe('tool_get_context');
    expect(cursorSchema.name).toBe('projectmind_get_context');
    expect(cursorSchema.readOnly).toBe(true);
    expect(cursorSchema.category).toBe('CONTEXT');
  });

  it('maps tool to Generic canonical format preserving full attributes', () => {
    const genericSchema = mapper.mapToolToProviderSchema(mockTool, 'GENERIC') as any;

    expect(genericSchema.toolId).toBe('tool_get_context');
    expect(genericSchema.version).toBe('1.0.0');
    expect(genericSchema.safetyLevel).toBe('READ_ONLY');
    expect(genericSchema.idempotent).toBe(true);
    expect(genericSchema.retryable).toBe(true);
  });

  it('maps multiple tools in batch for a given provider', () => {
    const batch = mapper.mapToolsToProviderSchemas([mockTool, mockTool], 'OPENAI');
    expect(batch).toHaveLength(2);
    expect(batch[0]?.type).toBe('function');
    expect(batch[1]?.type).toBe('function');
  });
});
