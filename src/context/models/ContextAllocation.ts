import type { ContextSection } from './ContextSection.js';

export interface ContextAllocation {
  sectionAllocations: Record<string, number>;
  actualUsage: Record<string, number>;
  totalAllocated: number;
  totalUsed: number;
  remainingTokens: number;
  truncatedSections: ContextSection[];
  omittedSections: ContextSection[];
}
