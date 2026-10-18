import type { ContextPackage } from './ContextPackage.js';
import type { ContextFormat } from './ContextFormat.js';

export interface ContextAdapterRequest {
  package: ContextPackage;
  format?: ContextFormat | undefined;
  systemInstructions?: string | undefined;
  userPrompt?: string | undefined;
  includeDelimiters?: boolean | undefined;
  includeMetadata?: boolean | undefined;
  includeExplanations?: boolean | undefined;
  maxTokens?: number | undefined;
}
