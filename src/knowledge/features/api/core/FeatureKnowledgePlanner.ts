import type {
  IFeatureKnowledgePlanner,
  FeatureKnowledgeExecutionPlan,
} from '../interfaces/IFeatureKnowledgePlanner.js';
import type { FeatureKnowledgeQuery } from '../models/FeatureKnowledgeQuery.js';
import type { FeatureKnowledgeSection } from '../models/FeatureKnowledgeSection.js';

export class FeatureKnowledgePlanner implements IFeatureKnowledgePlanner {
  public createPlan(query: FeatureKnowledgeQuery): FeatureKnowledgeExecutionPlan {
    const resolvedSections = new Set<FeatureKnowledgeSection>();

    // 1. Determine base requested sections
    if (query.sections && query.sections.length > 0) {
      for (const section of query.sections) {
        resolvedSections.add(section);
      }
    } else {
      // Default: request all primary sections if no specific sections specified
      resolvedSections.add('IDENTITY');
      resolvedSections.add('METADATA');
      resolvedSections.add('MAPPINGS');
      resolvedSections.add('DEPENDENCIES');
      resolvedSections.add('DEPENDENTS');
      resolvedSections.add('RELATIONSHIPS');
      resolvedSections.add('ENTRY_POINTS');
      resolvedSections.add('BEHAVIOR');
      resolvedSections.add('FLOWS');
      resolvedSections.add('HEALTH');
      resolvedSections.add('RISKS');
      resolvedSections.add('IMPACT');
      resolvedSections.add('HISTORY');
      resolvedSections.add('MILESTONES');
      resolvedSections.add('TRENDS');
      resolvedSections.add('MATURITY');
      resolvedSections.add('ARCHITECTURE');
      resolvedSections.add('SUMMARY');
      resolvedSections.add('REFERENCES');
    }

    // 2. Apply boolean flag overrides
    if (query.includeDependencies === true) {
      resolvedSections.add('DEPENDENCIES');
      resolvedSections.add('DEPENDENTS');
      resolvedSections.add('RELATIONSHIPS');
    } else if (query.includeDependencies === false) {
      resolvedSections.delete('DEPENDENCIES');
      resolvedSections.delete('DEPENDENTS');
      resolvedSections.delete('RELATIONSHIPS');
    }

    if (query.includeDependents === true) {
      resolvedSections.add('DEPENDENTS');
    } else if (query.includeDependents === false) {
      resolvedSections.delete('DEPENDENTS');
    }

    if (query.includeBehavior === true) {
      resolvedSections.add('BEHAVIOR');
      resolvedSections.add('FLOWS');
      resolvedSections.add('ENTRY_POINTS');
    } else if (query.includeBehavior === false) {
      resolvedSections.delete('BEHAVIOR');
      resolvedSections.delete('FLOWS');
      resolvedSections.delete('ENTRY_POINTS');
    }

    if (query.includeHealth === true) {
      resolvedSections.add('HEALTH');
      resolvedSections.add('RISKS');
    } else if (query.includeHealth === false) {
      resolvedSections.delete('HEALTH');
      resolvedSections.delete('RISKS');
    }

    if (query.includeImpact === true) {
      resolvedSections.add('IMPACT');
    } else if (query.includeImpact === false) {
      resolvedSections.delete('IMPACT');
    }

    if (query.includeHistory === true) {
      resolvedSections.add('HISTORY');
      resolvedSections.add('MILESTONES');
      resolvedSections.add('TRENDS');
      resolvedSections.add('MATURITY');
    } else if (query.includeHistory === false) {
      resolvedSections.delete('HISTORY');
      resolvedSections.delete('MILESTONES');
      resolvedSections.delete('TRENDS');
      resolvedSections.delete('MATURITY');
    }

    if (query.includeArchitecture === true) {
      resolvedSections.add('ARCHITECTURE');
    } else if (query.includeArchitecture === false) {
      resolvedSections.delete('ARCHITECTURE');
    }

    if (query.includeSummary === true) {
      resolvedSections.add('SUMMARY');
    } else if (query.includeSummary === false) {
      resolvedSections.delete('SUMMARY');
    }

    if (query.includeExplanations === true) {
      resolvedSections.add('EXPLANATION');
    } else if (query.includeExplanations === false) {
      resolvedSections.delete('EXPLANATION');
    }

    if (query.includeReferences === true) {
      resolvedSections.add('REFERENCES');
    } else if (query.includeReferences === false) {
      resolvedSections.delete('REFERENCES');
    }

    if (query.includeContextPackage === true) {
      resolvedSections.add('CONTEXT');
    }

    // 3. Section Dependencies Resolution:
    // If CONTEXT is requested, expand into essential context sections
    if (resolvedSections.has('CONTEXT')) {
      resolvedSections.add('IDENTITY');
      resolvedSections.add('MAPPINGS');
      resolvedSections.add('DEPENDENCIES');
      resolvedSections.add('ENTRY_POINTS');
      resolvedSections.add('BEHAVIOR');
      resolvedSections.add('HEALTH');
      resolvedSections.add('RISKS');
      resolvedSections.add('IMPACT');
      resolvedSections.add('HISTORY');
      resolvedSections.add('SUMMARY');
    }

    // If SUMMARY is requested, ensure core subsystems are loaded to produce a rich summary
    if (resolvedSections.has('SUMMARY')) {
      resolvedSections.add('IDENTITY');
      resolvedSections.add('MAPPINGS');
      resolvedSections.add('DEPENDENCIES');
      resolvedSections.add('BEHAVIOR');
      resolvedSections.add('HEALTH');
      resolvedSections.add('HISTORY');
    }

    // If ENTRY_POINTS is requested, needs mapping & behavior
    if (resolvedSections.has('ENTRY_POINTS')) {
      resolvedSections.add('MAPPINGS');
      resolvedSections.add('BEHAVIOR');
    }

    // Baseline: Identity is always required to identify the feature
    resolvedSections.add('IDENTITY');

    // 4. Re-apply explicit exclusions if specified
    if (query.includeDependencies === false) {
      resolvedSections.delete('DEPENDENCIES');
      resolvedSections.delete('DEPENDENTS');
      resolvedSections.delete('RELATIONSHIPS');
    }
    if (query.includeBehavior === false) {
      resolvedSections.delete('BEHAVIOR');
      resolvedSections.delete('FLOWS');
      resolvedSections.delete('ENTRY_POINTS');
    }
    if (query.includeHealth === false) {
      resolvedSections.delete('HEALTH');
      resolvedSections.delete('RISKS');
    }
    if (query.includeImpact === false) {
      resolvedSections.delete('IMPACT');
    }
    if (query.includeHistory === false) {
      resolvedSections.delete('HISTORY');
      resolvedSections.delete('MILESTONES');
      resolvedSections.delete('TRENDS');
      resolvedSections.delete('MATURITY');
    }
    if (query.includeArchitecture === false) {
      resolvedSections.delete('ARCHITECTURE');
    }
    if (query.includeSummary === false) {
      resolvedSections.delete('SUMMARY');
    }

    // 4. Map to subsystems to call
    const subsystemsToCall = {
      identity: true, // Always verify/resolve identity
      mapping:
        resolvedSections.has('MAPPINGS') ||
        resolvedSections.has('ENTRY_POINTS') ||
        resolvedSections.has('REFERENCES') ||
        resolvedSections.has('ARCHITECTURE'),
      dependencies:
        resolvedSections.has('DEPENDENCIES') ||
        resolvedSections.has('DEPENDENTS') ||
        resolvedSections.has('RELATIONSHIPS') ||
        resolvedSections.has('ARCHITECTURE'),
      behavior:
        resolvedSections.has('BEHAVIOR') ||
        resolvedSections.has('FLOWS') ||
        resolvedSections.has('ENTRY_POINTS'),
      health:
        resolvedSections.has('HEALTH') ||
        resolvedSections.has('RISKS'),
      impact:
        resolvedSections.has('IMPACT'),
      history:
        resolvedSections.has('HISTORY') ||
        resolvedSections.has('MILESTONES') ||
        resolvedSections.has('TRENDS') ||
        resolvedSections.has('MATURITY'),
      architecture:
        resolvedSections.has('ARCHITECTURE'),
    };

    return {
      featureId: query.featureId,
      resolvedSections,
      subsystemsToCall,
      options: {
        maxDepth: query.maxDepth,
        maxItemsPerSection: query.maxItemsPerSection,
        tokenBudget: query.tokenBudget,
        compactMode: query.compactMode,
      },
    };
  }
}
