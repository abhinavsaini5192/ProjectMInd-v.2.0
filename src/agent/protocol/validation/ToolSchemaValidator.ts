import type { ToolInputSchema, ToolProperty } from '../models/ToolSchema.js';
import { ToolArgumentError } from '../errors/ToolArgumentError.js';

export class ToolSchemaValidator {
  private static readonly MAX_VALIDATION_DEPTH = 10;

  public static validate(
    schema: ToolInputSchema,
    args: Record<string, unknown>,
    toolName: string,
    requestId?: string
  ): void {
    if (!args || typeof args !== 'object' || Array.isArray(args)) {
      throw new ToolArgumentError(
        `Arguments for tool '${toolName}' must be a valid non-null key-value object`,
        { toolName, received: typeof args },
        requestId
      );
    }

    // 1. Verify required properties
    if (schema.required) {
      for (const requiredKey of schema.required) {
        if (!(requiredKey in args) || args[requiredKey] === undefined) {
          throw new ToolArgumentError(
            `Missing required argument '${requiredKey}' for tool '${toolName}'`,
            { toolName, missingField: requiredKey },
            requestId
          );
        }
      }
    }

    // 2. Verify additionalProperties policy
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(args)) {
        if (!(key in schema.properties)) {
          throw new ToolArgumentError(
            `Unknown or forbidden argument '${key}' for tool '${toolName}'`,
            { toolName, disallowedField: key },
            requestId
          );
        }
      }
    }

    // 3. Verify individual property types and constraints
    for (const [key, value] of Object.entries(args)) {
      if (value === undefined) continue;
      const prop = schema.properties[key];
      if (prop) {
        this.validateProperty(key, value, prop, toolName, 0, requestId);
      }
    }
  }

  private static validateProperty(
    field: string,
    value: unknown,
    prop: ToolProperty,
    toolName: string,
    depth: number,
    requestId?: string
  ): void {
    if (depth > this.MAX_VALIDATION_DEPTH) {
      throw new ToolArgumentError(
        `Argument '${field}' exceeds maximum allowable nesting depth`,
        { toolName, field, depth },
        requestId
      );
    }

    // Check type
    switch (prop.type) {
      case 'string':
        if (typeof value !== 'string') {
          throw new ToolArgumentError(
            `Argument '${field}' must be a string, received ${typeof value}`,
            { toolName, field, expectedType: 'string', receivedType: typeof value },
            requestId
          );
        }
        if (prop.minLength !== undefined && value.length < prop.minLength) {
          throw new ToolArgumentError(
            `Argument '${field}' length (${value.length}) is less than minimum (${prop.minLength})`,
            { toolName, field, minLength: prop.minLength, actualLength: value.length },
            requestId
          );
        }
        if (prop.maxLength !== undefined && value.length > prop.maxLength) {
          throw new ToolArgumentError(
            `Argument '${field}' length (${value.length}) exceeds maximum (${prop.maxLength})`,
            { toolName, field, maxLength: prop.maxLength, actualLength: value.length },
            requestId
          );
        }
        if (prop.enum !== undefined && !(prop.enum as readonly unknown[]).includes(value)) {
          throw new ToolArgumentError(
            `Argument '${field}' value '${value}' is not among permitted values: ${prop.enum.join(', ')}`,
            { toolName, field, permitted: prop.enum, received: value },
            requestId
          );
        }
        break;

      case 'integer':
        if (typeof value !== 'number' || !Number.isInteger(value)) {
          throw new ToolArgumentError(
            `Argument '${field}' must be an integer, received ${typeof value === 'number' ? value : typeof value}`,
            { toolName, field, expectedType: 'integer', received: value },
            requestId
          );
        }
        if (prop.minimum !== undefined && value < prop.minimum) {
          throw new ToolArgumentError(
            `Argument '${field}' value (${value}) is less than minimum (${prop.minimum})`,
            { toolName, field, minimum: prop.minimum, actual: value },
            requestId
          );
        }
        if (prop.maximum !== undefined && value > prop.maximum) {
          throw new ToolArgumentError(
            `Argument '${field}' value (${value}) exceeds maximum (${prop.maximum})`,
            { toolName, field, maximum: prop.maximum, actual: value },
            requestId
          );
        }
        if (prop.enum !== undefined && !(prop.enum as readonly unknown[]).includes(value)) {
          throw new ToolArgumentError(
            `Argument '${field}' value '${value}' is not among permitted values: ${prop.enum.join(', ')}`,
            { toolName, field, permitted: prop.enum, received: value },
            requestId
          );
        }
        break;

      case 'number':
        if (typeof value !== 'number' || Number.isNaN(value)) {
          throw new ToolArgumentError(
            `Argument '${field}' must be a number, received ${typeof value}`,
            { toolName, field, expectedType: 'number', receivedType: typeof value },
            requestId
          );
        }
        if (prop.minimum !== undefined && value < prop.minimum) {
          throw new ToolArgumentError(
            `Argument '${field}' value (${value}) is less than minimum (${prop.minimum})`,
            { toolName, field, minimum: prop.minimum, actual: value },
            requestId
          );
        }
        if (prop.maximum !== undefined && value > prop.maximum) {
          throw new ToolArgumentError(
            `Argument '${field}' value (${value}) exceeds maximum (${prop.maximum})`,
            { toolName, field, maximum: prop.maximum, actual: value },
            requestId
          );
        }
        if (prop.enum !== undefined && !(prop.enum as readonly unknown[]).includes(value)) {
          throw new ToolArgumentError(
            `Argument '${field}' value '${value}' is not among permitted values: ${prop.enum.join(', ')}`,
            { toolName, field, permitted: prop.enum, received: value },
            requestId
          );
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          throw new ToolArgumentError(
            `Argument '${field}' must be a boolean, received ${typeof value}`,
            { toolName, field, expectedType: 'boolean', receivedType: typeof value },
            requestId
          );
        }
        break;

      case 'array':
        if (!Array.isArray(value)) {
          throw new ToolArgumentError(
            `Argument '${field}' must be an array, received ${typeof value}`,
            { toolName, field, expectedType: 'array', receivedType: typeof value },
            requestId
          );
        }
        if (prop.minItems !== undefined && value.length < prop.minItems) {
          throw new ToolArgumentError(
            `Argument '${field}' item count (${value.length}) is below minimum (${prop.minItems})`,
            { toolName, field, minItems: prop.minItems, actualCount: value.length },
            requestId
          );
        }
        if (prop.maxItems !== undefined && value.length > prop.maxItems) {
          throw new ToolArgumentError(
            `Argument '${field}' item count (${value.length}) exceeds maximum (${prop.maxItems})`,
            { toolName, field, maxItems: prop.maxItems, actualCount: value.length },
            requestId
          );
        }
        if (prop.items) {
          for (let i = 0; i < value.length; i++) {
            this.validateProperty(`${field}[${i}]`, value[i], prop.items, toolName, depth + 1, requestId);
          }
        }
        break;

      case 'object':
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          throw new ToolArgumentError(
            `Argument '${field}' must be a non-null object, received ${typeof value}`,
            { toolName, field, expectedType: 'object', receivedType: typeof value },
            requestId
          );
        }
        if (prop.properties) {
          for (const [subKey, subVal] of Object.entries(value as Record<string, unknown>)) {
            const subProp = prop.properties[subKey];
            if (subProp) {
              this.validateProperty(`${field}.${subKey}`, subVal, subProp, toolName, depth + 1, requestId);
            }
          }
        }
        break;
    }
  }
}
