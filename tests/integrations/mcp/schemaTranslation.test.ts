import { describe, it, expect } from 'vitest';
import { McpSchemaTranslator } from '../../../src/integrations/mcp/schemas/McpSchemaTranslator.js';
import { createCanonicalToolRegistry } from '../../../src/agent/protocol/registry/ToolManifest.js';
import type { ToolInputSchema } from '../../../src/agent/protocol/models/ToolSchema.js';

describe('McpSchemaTranslator', () => {
  it('translates primitive property types into MCP JSON Schema Draft-7', () => {
    const inputSchema: ToolInputSchema = {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term', required: true },
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
        ratio: { type: 'number', minimum: 0, maximum: 1 },
        isActive: { type: 'boolean', default: true },
      },
      required: ['query'],
    };

    const translated = McpSchemaTranslator.translateInputSchema(inputSchema);

    expect(translated.type).toBe('object');
    expect(translated.additionalProperties).toBe(false);
    expect(translated.required).toContain('query');
    expect(translated.properties.query?.type).toBe('string');
    expect(translated.properties.query?.description).toBe('Search term');
    expect(translated.properties.limit?.type).toBe('integer');
    expect(translated.properties.limit?.minimum).toBe(1);
    expect(translated.properties.limit?.maximum).toBe(100);
    expect(translated.properties.limit?.default).toBe(10);
    expect(translated.properties.ratio?.type).toBe('number');
    expect(translated.properties.isActive?.type).toBe('boolean');
  });

  it('translates arrays and enum constraints correctly', () => {
    const inputSchema: ToolInputSchema = {
      type: 'object',
      properties: {
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of tags',
        },
        mode: {
          type: 'string',
          enum: ['SUMMARY', 'DETAILED', 'FULL'],
          default: 'SUMMARY',
        },
      },
    };

    const translated = McpSchemaTranslator.translateInputSchema(inputSchema);

    expect(translated.properties.tags?.type).toBe('array');
    expect(translated.properties.tags?.items?.type).toBe('string');
    expect(translated.properties.mode?.enum).toEqual(['SUMMARY', 'DETAILED', 'FULL']);
    expect(translated.properties.mode?.default).toBe('SUMMARY');
  });

  it('translates nested objects with recursive properties and nested required fields', () => {
    const inputSchema: ToolInputSchema = {
      type: 'object',
      properties: {
        filter: {
          type: 'object',
          properties: {
            category: { type: 'string', required: true },
            minScore: { type: 'number', minimum: 0 },
          },
        },
      },
    };

    const translated = McpSchemaTranslator.translateInputSchema(inputSchema);

    expect(translated.properties.filter?.type).toBe('object');
    expect(translated.properties.filter?.properties?.category?.type).toBe('string');
    expect(translated.properties.filter?.properties?.minScore?.minimum).toBe(0);
    expect(translated.properties.filter?.required).toContain('category');
  });

  it('translates all canonical tool schemas into compliant MCP schemas without errors', () => {
    const registry = createCanonicalToolRegistry();
    const tools = registry.listTools();

    expect(tools.length).toBe(36);


    for (const tool of tools) {
      const translated = McpSchemaTranslator.translateInputSchema(tool.inputSchema);
      expect(translated.type).toBe('object');
      expect(translated.properties).toBeDefined();
      expect(typeof translated.properties).toBe('object');
      expect(translated.additionalProperties).toBe(false);

      if (translated.required) {
        expect(Array.isArray(translated.required)).toBe(true);
        for (const req of translated.required) {
          expect(translated.properties[req]).toBeDefined();
        }
      }
    }
  });
});
