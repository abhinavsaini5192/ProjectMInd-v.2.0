import type { ContextSection } from '../models/ContextSection.js';

export class ContextBudgetAllocator {
  private static readonly DEFAULT_WEIGHTS: Record<ContextSection, number> = {
    IDENTITY: 10,
    RESOURCES: 35,
    ENTRY_POINTS: 10,
    BEHAVIOR: 15,
    DEPENDENCIES: 10,
    TESTS: 5,
    HEALTH: 5,
    IMPACT: 5,
    HISTORY: 5,
    ARCHITECTURE: 5,
    METADATA: 2,
    WARNINGS: 2,
    EXPLANATIONS: 5,
  };

  public static allocate(
    availableForContext: number,
    activeSections: ContextSection[] = ['IDENTITY', 'RESOURCES', 'ENTRY_POINTS', 'BEHAVIOR', 'DEPENDENCIES', 'TESTS', 'HEALTH', 'HISTORY']
  ): Record<string, number> {
    const allocations: Record<string, number> = {};
    const totalWeight = activeSections.reduce((sum, s) => sum + (this.DEFAULT_WEIGHTS[s] ?? 5), 0);

    for (const section of activeSections) {
      const weight = this.DEFAULT_WEIGHTS[section] ?? 5;
      allocations[section] = Math.max(10, Math.floor((weight / totalWeight) * availableForContext));
    }

    return allocations;
  }
}
