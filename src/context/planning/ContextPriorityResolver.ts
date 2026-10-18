import type { ContextSection } from '../models/ContextSection.js';
import type { ContextPriority } from '../models/ContextPriority.js';

export class ContextPriorityResolver {
  public static resolveSectionPriority(
    section: ContextSection,
    hasChangedResources: boolean = false,
    isExplicitlyRequested: boolean = false
  ): ContextPriority {
    if (isExplicitlyRequested) {
      return 'CRITICAL';
    }

    switch (section) {
      case 'IDENTITY':
      case 'RESOURCES':
      case 'ENTRY_POINTS':
        return 'CRITICAL';

      case 'IMPACT':
        return hasChangedResources ? 'CRITICAL' : 'HIGH';

      case 'BEHAVIOR':
      case 'DEPENDENCIES':
      case 'HEALTH':
      case 'ARCHITECTURE':
        return 'HIGH';

      case 'TESTS':
        return 'MEDIUM';

      case 'HISTORY':
      case 'EXPLANATIONS':
      case 'METADATA':
      case 'WARNINGS':
        return 'LOW';

      default:
        return 'MEDIUM';
    }
  }

  public static resolveResourcePriority(
    isChanged: boolean,
    isEntryPoint: boolean,
    isPrimary: boolean
  ): ContextPriority {
    if (isChanged) {
      return 'CRITICAL';
    }
    if (isEntryPoint || isPrimary) {
      return 'HIGH';
    }
    return 'MEDIUM';
  }

  public static resolveFeaturePriority(isTarget: boolean, depth: number): ContextPriority {
    if (isTarget) {
      return 'CRITICAL';
    }
    if (depth <= 1) {
      return 'HIGH';
    }
    if (depth <= 2) {
      return 'MEDIUM';
    }
    return 'LOW';
  }
}
