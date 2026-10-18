export type ToolSafetyLevel = 'READ_ONLY' | 'REPORT_ONLY' | 'CONTROLLED_WRITE';

export const TOOL_SAFETY_LEVELS: readonly ToolSafetyLevel[] = [
  'READ_ONLY',
  'REPORT_ONLY',
  'CONTROLLED_WRITE',
] as const;

export function isToolSafetyLevel(value: unknown): value is ToolSafetyLevel {
  return typeof value === 'string' && TOOL_SAFETY_LEVELS.includes(value as ToolSafetyLevel);
}
