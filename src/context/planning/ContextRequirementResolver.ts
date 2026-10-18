import type { ContextRequest } from '../models/ContextRequest.js';
import type { ContextSection } from '../models/ContextSection.js';
import type { ContextRequirement } from '../models/ContextRequirement.js';
import { ContextPriorityResolver } from './ContextPriorityResolver.js';

export class ContextRequirementResolver {
  public static resolveRequiredSections(request: ContextRequest): ContextSection[] {
    if (request.requestedSections && request.requestedSections.length > 0) {
      const sections = new Set<ContextSection>(request.requestedSections);
      // Ensure metadata and warnings are always present
      sections.add('METADATA');
      sections.add('WARNINGS');
      return Array.from(sections);
    }

    const sections = new Set<ContextSection>();

    // Core sections always required
    sections.add('IDENTITY');
    sections.add('RESOURCES');
    sections.add('ENTRY_POINTS');
    sections.add('METADATA');
    sections.add('WARNINGS');

    if (request.includeDependencies !== false) {
      sections.add('DEPENDENCIES');
    }

    if (request.includeBehavior !== false) {
      sections.add('BEHAVIOR');
    }

    if (request.includeTests !== false) {
      sections.add('TESTS');
    }

    if (request.includeHealth === true) {
      sections.add('HEALTH');
    }

    if (request.includeImpact === true || (request.changedResources && request.changedResources.length > 0)) {
      sections.add('IMPACT');
    }

    if (request.includeHistory === true) {
      sections.add('HISTORY');
    }

    if (request.explainSelection === true || request.includeExplanations === true) {
      sections.add('EXPLANATIONS');
    }

    return Array.from(sections);
  }

  public static resolveRequirements(
    request: ContextRequest,
    targetFeatureIds: string[]
  ): ContextRequirement[] {
    const requiredSections = this.resolveRequiredSections(request);
    const hasChanged = !!(request.changedResources && request.changedResources.length > 0);
    const explicitlyRequested = new Set(request.requestedSections ?? []);

    return requiredSections.map((section, idx) => {
      const priority = ContextPriorityResolver.resolveSectionPriority(
        section,
        hasChanged,
        explicitlyRequested.has(section)
      );

      const isCore = ['IDENTITY', 'RESOURCES', 'METADATA'].includes(section);

      return {
        id: `req-${section.toLowerCase()}-${idx}`,
        type: section,
        priority,
        required: isCore || explicitlyRequested.has(section),
        reason: this.getSectionReason(section, hasChanged),
        targetFeatureId: targetFeatureIds[0],
        freshnessPolicy: request.freshnessPolicy ?? 'CURRENT',
      };
    });
  }

  private static getSectionReason(section: ContextSection, hasChanged: boolean): string {
    switch (section) {
      case 'IDENTITY':
        return 'Feature identity and core metadata are required for semantic context.';
      case 'RESOURCES':
        return 'Mapped files and code symbols needed for editing or reference.';
      case 'ENTRY_POINTS':
        return 'Primary entry points indicate where feature invocation begins.';
      case 'BEHAVIOR':
        return 'Key execution flows and operations describe feature behavior.';
      case 'DEPENDENCIES':
        return 'Upstream and downstream feature dependencies prevent breaking changes.';
      case 'TESTS':
        return 'Associated test files ensure verification coverage.';
      case 'HEALTH':
        return 'Health metrics and active risks inform modification safety.';
      case 'IMPACT':
        return hasChanged
          ? 'Changed resources require blast radius and affected feature analysis.'
          : 'Change impact analysis shows potential regression points.';
      case 'HISTORY':
        return 'Evolutionary history documents architectural changes over time.';
      case 'ARCHITECTURE':
        return 'Architectural boundaries and component roles.';
      case 'METADATA':
        return 'Context provenance, versioning, and completeness indicators.';
      case 'WARNINGS':
        return 'Budget truncation or context fidelity warnings.';
      case 'EXPLANATIONS':
        return 'Reasoning behind context selection and priority ranking.';
      default:
        return 'Context section required for AI task completion.';
    }
  }
}
