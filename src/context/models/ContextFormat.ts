export type ContextFormat =
  | 'generic-markdown'
  | 'claude-xml'
  | 'openai-markdown'
  | 'gemini-markdown'
  | 'cursor-compact'
  | 'codex-code'
  | 'json';

export const CONTEXT_FORMATS: readonly ContextFormat[] = [
  'generic-markdown',
  'claude-xml',
  'openai-markdown',
  'gemini-markdown',
  'cursor-compact',
  'codex-code',
  'json',
] as const;

export function isContextFormat(value: unknown): value is ContextFormat {
  return typeof value === 'string' && CONTEXT_FORMATS.includes(value as ContextFormat);
}
