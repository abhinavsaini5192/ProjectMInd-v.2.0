import type { ToolInputSchema, ToolProperty } from '../../../agent/protocol/models/ToolSchema.js';
import type { McpJsonSchema, McpJsonSchemaProperty } from '../protocol/McpTypes.js';

/**
 * Translates canonical ProjectMind ToolInputSchemas to standard
 * MCP-compliant JSON Schema Draft-7 schemas.
 */
export class McpSchemaTranslator {
  /**
   * Translate a canonical ToolInputSchema to an MCP-compliant JSON Schema object.
   */
  public static translateInputSchema(canonicalSchema: ToolInputSchema): McpJsonSchema {
    const translatedProperties: Record<string, McpJsonSchemaProperty> = {};
    const requiredSet = new Set<string>();

    if (canonicalSchema.required) {
      for (const field of canonicalSchema.required) {
        requiredSet.add(field);
      }
    }

    if (canonicalSchema.properties) {
      for (const [key, prop] of Object.entries(canonicalSchema.properties)) {
        translatedProperties[key] = this.translateProperty(prop);
        if (prop.required) {
          requiredSet.add(key);
        }
      }
    }

    const result: McpJsonSchema = {
      type: 'object',
      properties: translatedProperties,
    };

    if (requiredSet.size > 0) {
      result.required = Array.from(requiredSet);
    }

    if (canonicalSchema.additionalProperties !== undefined) {
      result.additionalProperties = canonicalSchema.additionalProperties;
    } else {
      result.additionalProperties = false;
    }

    return result;
  }

  /**
   * Translates a single canonical ToolProperty to an McpJsonSchemaProperty.
   */
  public static translateProperty(property: ToolProperty): McpJsonSchemaProperty {
    const mcpProp: McpJsonSchemaProperty = {
      type: property.type,
    };

    if (property.description !== undefined) {
      mcpProp.description = property.description;
    }

    if (property.enum !== undefined && property.enum.length > 0) {
      mcpProp.enum = [...property.enum];
    }

    if (property.type === 'array' && property.items) {
      mcpProp.items = this.translateProperty(property.items);
    }

    if (property.type === 'object' && property.properties) {
      const nestedProps: Record<string, McpJsonSchemaProperty> = {};
      const nestedRequired: string[] = [];

      for (const [childKey, childProp] of Object.entries(property.properties)) {
        nestedProps[childKey] = this.translateProperty(childProp);
        if (childProp.required) {
          nestedRequired.push(childKey);
        }
      }

      mcpProp.properties = nestedProps;
      if (nestedRequired.length > 0) {
        mcpProp.required = nestedRequired;
      }
    }

    if (property.minimum !== undefined) {
      mcpProp.minimum = property.minimum;
    }

    if (property.maximum !== undefined) {
      mcpProp.maximum = property.maximum;
    }

    if (property.default !== undefined) {
      mcpProp.default = property.default;
    }

    return mcpProp;
  }
}
