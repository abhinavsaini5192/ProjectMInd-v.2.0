import { describe, it, expect } from 'vitest';
import { ToolSchemaValidator } from '../../../src/agent/protocol/validation/ToolSchemaValidator.js';
import { ToolArgumentError } from '../../../src/agent/protocol/errors/ToolArgumentError.js';
import type { ToolInputSchema } from '../../../src/agent/protocol/models/ToolSchema.js';

describe('ToolSchemaValidator', () => {
  it('validates required fields successfully', () => {
    const schema: ToolInputSchema = {
      type: 'object',
      properties: {
        taskId: { type: 'string', minLength: 1 },
      },
      required: ['taskId'],
    };

    expect(() =>
      ToolSchemaValidator.validate(schema, { taskId: 'task-1' }, 'test_tool')
    ).not.toThrow();

    expect(() => ToolSchemaValidator.validate(schema, {}, 'test_tool')).toThrow(
      ToolArgumentError
    );
    expect(() => ToolSchemaValidator.validate(schema, {}, 'test_tool')).toThrow(
      /Missing required argument 'taskId'/
    );
  });

  it('validates string constraints (minLength, maxLength, enum)', () => {
    const schema: ToolInputSchema = {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 3, maxLength: 10 },
        status: { type: 'string', enum: ['PENDING', 'ACTIVE'] },
      },
    };

    // Valid
    expect(() =>
      ToolSchemaValidator.validate(schema, { name: 'admin', status: 'ACTIVE' }, 'test_tool')
    ).not.toThrow();

    // Too short
    expect(() =>
      ToolSchemaValidator.validate(schema, { name: 'ab' }, 'test_tool')
    ).toThrow(/less than minimum/);

    // Too long
    expect(() =>
      ToolSchemaValidator.validate(schema, { name: 'supercalifragilistic' }, 'test_tool')
    ).toThrow(/exceeds maximum/);

    // Invalid enum
    expect(() =>
      ToolSchemaValidator.validate(schema, { status: 'UNKNOWN' }, 'test_tool')
    ).toThrow(/not among permitted values/);
  });

  it('validates numeric constraints (number, integer, min, max)', () => {
    const schema: ToolInputSchema = {
      type: 'object',
      properties: {
        count: { type: 'integer', minimum: 1, maximum: 100 },
        ratio: { type: 'number', minimum: 0, maximum: 1 },
      },
    };

    expect(() =>
      ToolSchemaValidator.validate(schema, { count: 50, ratio: 0.75 }, 'test_tool')
    ).not.toThrow();

    // Non-integer
    expect(() =>
      ToolSchemaValidator.validate(schema, { count: 3.14 }, 'test_tool')
    ).toThrow(/must be an integer/);

    // Below minimum
    expect(() =>
      ToolSchemaValidator.validate(schema, { count: 0 }, 'test_tool')
    ).toThrow(/is less than minimum/);

    // Above maximum
    expect(() =>
      ToolSchemaValidator.validate(schema, { ratio: 1.5 }, 'test_tool')
    ).toThrow(/exceeds maximum/);
  });

  it('validates array constraints (type, minItems, maxItems, items type)', () => {
    const schema: ToolInputSchema = {
      type: 'object',
      properties: {
        tags: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          maxItems: 3,
        },
      },
    };

    expect(() =>
      ToolSchemaValidator.validate(schema, { tags: ['alpha', 'beta'] }, 'test_tool')
    ).not.toThrow();

    // Too few items
    expect(() =>
      ToolSchemaValidator.validate(schema, { tags: [] }, 'test_tool')
    ).toThrow(/below minimum/);

    // Too many items
    expect(() =>
      ToolSchemaValidator.validate(schema, { tags: ['a', 'b', 'c', 'd'] }, 'test_tool')
    ).toThrow(/exceeds maximum/);

    // Wrong item type
    expect(() =>
      ToolSchemaValidator.validate(schema, { tags: ['alpha', 123] }, 'test_tool')
    ).toThrow(/must be a string/);
  });

  it('validates nested object properties recursively', () => {
    const schema: ToolInputSchema = {
      type: 'object',
      properties: {
        config: {
          type: 'object',
          properties: {
            debug: { type: 'boolean' },
            port: { type: 'integer', minimum: 1024 },
          },
          required: true,
        },
      },
    };

    expect(() =>
      ToolSchemaValidator.validate(
        schema,
        { config: { debug: true, port: 8080 } },
        'test_tool'
      )
    ).not.toThrow();

    expect(() =>
      ToolSchemaValidator.validate(
        schema,
        { config: { debug: 'not-bool', port: 8080 } },
        'test_tool'
      )
    ).toThrow(/must be a boolean/);
  });

  it('rejects additional properties when additionalProperties is false', () => {
    const schema: ToolInputSchema = {
      type: 'object',
      properties: {
        target: { type: 'string' },
      },
      additionalProperties: false,
    };

    expect(() =>
      ToolSchemaValidator.validate(schema, { target: 'ok' }, 'test_tool')
    ).not.toThrow();

    expect(() =>
      ToolSchemaValidator.validate(schema, { target: 'ok', malicious: 'payload' }, 'test_tool')
    ).toThrow(ToolArgumentError);
    expect(() =>
      ToolSchemaValidator.validate(schema, { target: 'ok', malicious: 'payload' }, 'test_tool')
    ).toThrow(/Unknown or forbidden argument 'malicious'/);
  });
});
