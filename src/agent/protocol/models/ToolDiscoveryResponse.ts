import type { ToolCategory } from './ToolCategory.js';
import type { ToolSafetyLevel } from './ToolSafetyLevel.js';
import type { ToolScopeRequirement } from './ToolScopeRequirement.js';
import type { ToolInputSchema, ToolOutputSchema, ToolLimits } from './ToolSchema.js';
import type { AgentCapability } from '../../models/AgentCapability.js';

export interface ToolDiscoveryItem {
  readonly name: string;
  readonly description: string;
  readonly category: ToolCategory;
  readonly version: string;
  readonly inputSchema: ToolInputSchema;
  readonly outputSchema: ToolOutputSchema;
  readonly requiredCapabilities: readonly AgentCapability[];
  readonly requiredScope: ToolScopeRequirement;
  readonly safetyLevel: ToolSafetyLevel;
  readonly limits: ToolLimits;
  readonly idempotent: boolean;
  readonly retryable: boolean;
  readonly enabled: boolean;
}

export interface ToolDiscoveryResponse {
  readonly protocolVersion: string;
  readonly tools: readonly ToolDiscoveryItem[];
  readonly categories: readonly ToolCategory[];
  readonly totalTools: number;
}
