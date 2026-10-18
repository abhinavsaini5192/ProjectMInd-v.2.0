export type ToolScopeRequirement =
  | 'NONE'
  | 'WORKSPACE_REQUIRED'
  | 'REPOSITORY_REQUIRED'
  | 'SESSION_REQUIRED';

export const TOOL_SCOPE_REQUIREMENTS: readonly ToolScopeRequirement[] = [
  'NONE',
  'WORKSPACE_REQUIRED',
  'REPOSITORY_REQUIRED',
  'SESSION_REQUIRED',
] as const;

export function isToolScopeRequirement(value: unknown): value is ToolScopeRequirement {
  return typeof value === 'string' && TOOL_SCOPE_REQUIREMENTS.includes(value as ToolScopeRequirement);
}
