import type { ContextSection } from './ContextSection.js';
import type { ContextPriority } from './ContextPriority.js';
import type { ContextRelevance } from './ContextRelevance.js';

export interface ContextItem {
  id: string;
  section: ContextSection;
  title: string;
  content: string;
  priority: ContextPriority;
  relevance: ContextRelevance;
  estimatedTokens: number;
  sourceSubsystem: string;
  sourceFeatureId?: string | undefined;
  tags?: string[] | undefined;
}
