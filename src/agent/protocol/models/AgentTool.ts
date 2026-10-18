import type { ToolCategory } from './ToolCategory.js';
import type { ToolSafetyLevel } from './ToolSafetyLevel.js';
import type { ToolScopeRequirement } from './ToolScopeRequirement.js';
import type { ToolInputSchema, ToolOutputSchema, ToolLimits } from './ToolSchema.js';
import type { AgentCapability } from '../../models/AgentCapability.js';
import type { AgentOperationType } from '../../models/AgentOperation.js';

/**
 * Canonical provider-neutral tool definition in ProjectMind.
 */
export interface AgentTool {
  readonly toolId: string;
  readonly name: string;
  readonly description: string;
  readonly category: ToolCategory;
  readonly version: string;
  readonly operation: AgentOperationType;
  readonly inputSchema: ToolInputSchema;
  readonly outputSchema: ToolOutputSchema;
  readonly requiredCapabilities: readonly AgentCapability[];
  readonly requiredScope: ToolScopeRequirement;
  readonly safetyLevel: ToolSafetyLevel;
  readonly limits: ToolLimits;
  readonly metadata?: Record<string, unknown> | undefined;
  readonly enabled: boolean;
  readonly idempotent: boolean;
  readonly retryable: boolean;
}
