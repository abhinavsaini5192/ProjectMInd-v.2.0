export type ToolCategory =
  | 'CONTEXT'
  | 'FEATURE'
  | 'ARCHITECTURE'
  | 'IMPACT'
  | 'HISTORY'
  | 'HEALTH'
  | 'KNOWLEDGE'
  | 'SESSION'
  | 'EXECUTION'
  | 'VERIFICATION'
  | 'SYSTEM'
  | 'TASK'
  | 'OBSERVATION';

export const TOOL_CATEGORIES: readonly ToolCategory[] = [
  'CONTEXT',
  'FEATURE',
  'ARCHITECTURE',
  'IMPACT',
  'HISTORY',
  'HEALTH',
  'KNOWLEDGE',
  'SESSION',
  'EXECUTION',
  'VERIFICATION',
  'SYSTEM',
  'TASK',
  'OBSERVATION',
] as const;

export function isToolCategory(value: unknown): value is ToolCategory {
  return typeof value === 'string' && TOOL_CATEGORIES.includes(value as ToolCategory);
}
