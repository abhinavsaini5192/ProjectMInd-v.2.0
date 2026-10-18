import type { ContextFormat } from './ContextFormat.js';

export interface ContextAdapterResponse {
  formattedContent: string;
  format: ContextFormat;
  estimatedTokens: number;
  sectionsFormatted: string[];
  metadata: Record<string, any>;
}
