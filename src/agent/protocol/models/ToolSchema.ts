export type ToolPropertyType = 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';

export interface ToolProperty {
  readonly type: ToolPropertyType;
  readonly description?: string | undefined;
  readonly required?: boolean | undefined;
  readonly enum?: readonly (string | number)[] | undefined;
  readonly items?: ToolProperty | undefined;
  readonly properties?: Record<string, ToolProperty> | undefined;
  readonly minimum?: number | undefined;
  readonly maximum?: number | undefined;
  readonly minLength?: number | undefined;
  readonly maxLength?: number | undefined;
  readonly minItems?: number | undefined;
  readonly maxItems?: number | undefined;
  readonly default?: unknown | undefined;
}

export interface ToolInputSchema {
  readonly type: 'object';
  readonly properties: Record<string, ToolProperty>;
  readonly required?: readonly string[] | undefined;
  readonly additionalProperties?: boolean | undefined;
}

export interface ToolOutputSchema {
  readonly type: 'object';
  readonly description?: string | undefined;
  readonly properties?: Record<string, ToolProperty> | undefined;
  readonly required?: readonly string[] | undefined;
}

export interface ToolLimits {
  readonly maxTokenBudget?: number | undefined;
  readonly maxDepth?: number | undefined;
  readonly maxResults?: number | undefined;
  readonly maxInputLength?: number | undefined;
  readonly maxArraySize?: number | undefined;
  readonly defaultTimeoutMs?: number | undefined;
  readonly maxTimeoutMs?: number | undefined;
  readonly maxExecutionTimeMs?: number | undefined;
  readonly maxPayloadBytes?: number | undefined;
}
