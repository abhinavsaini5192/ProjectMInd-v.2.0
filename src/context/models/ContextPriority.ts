export type ContextPriority =
  | 'CRITICAL'
  | 'HIGH'
  | 'MEDIUM'
  | 'LOW'
  | 'BACKGROUND';

export const CONTEXT_PRIORITY_WEIGHTS: Record<ContextPriority, number> = {
  CRITICAL: 100,
  HIGH: 80,
  MEDIUM: 60,
  LOW: 40,
  BACKGROUND: 20,
};

export const CONTEXT_PRIORITIES: readonly ContextPriority[] = [
  'CRITICAL',
  'HIGH',
  'MEDIUM',
  'LOW',
  'BACKGROUND',
] as const;

export function isContextPriority(value: unknown): value is ContextPriority {
  return typeof value === 'string' && CONTEXT_PRIORITIES.includes(value as ContextPriority);
}
