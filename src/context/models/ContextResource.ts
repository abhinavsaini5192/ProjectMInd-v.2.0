import type { ContextRelevance } from './ContextRelevance.js';
import type { ContextPriority } from './ContextPriority.js';

export interface ContextResource {
  resourceId: string;
  filePath?: string | undefined;
  path?: string | undefined;
  symbolName?: string | undefined;
  role: string;
  featureId: string;
  relevance: ContextRelevance;
  priority: ContextPriority;
  snippet?: string | undefined;
  content?: string | undefined;
  contentHash?: string | undefined;
  metadata?: Record<string, any> | undefined;
  estimatedTokens?: number | undefined;
  tokenCount?: number | undefined;
}
