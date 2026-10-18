import type { IContextPacker, BuildPackageParams } from '../interfaces/IContextPacker.js';
import type { ContextPackage } from '../models/ContextPackage.js';
import { ContextSectionPacker } from './ContextSectionPacker.js';
import { ContextReferencePacker } from './ContextReferencePacker.js';
import { ContextMetadataPacker } from './ContextMetadataPacker.js';
import { ContextIntegrityValidator } from './ContextIntegrityValidator.js';

export class ContextPackageBuilder implements IContextPacker {
  public buildPackage(params: BuildPackageParams): ContextPackage {
    const { request, plan, selected, allocation, warnings, retrieved } = params;

    // 1. Bind references
    const boundFeatures = ContextReferencePacker.bindFeatureReferences(
      selected.features,
      selected.resources,
      selected.behaviorFlows
    );

    // 2. Pack sections
    const dependencies = ContextSectionPacker.packDependencies(retrieved);
    const health = ContextSectionPacker.packHealth(selected, retrieved);
    const impact = ContextSectionPacker.packImpact(retrieved);
    const architecture = ContextSectionPacker.packArchitecture(retrieved);

    // 3. Compute metadata
    const completeness = ContextMetadataPacker.computeCompleteness(plan, selected);
    const freshness = ContextMetadataPacker.computeFreshness(retrieved);
    const version = ContextMetadataPacker.computeVersion(retrieved);

    // 4. Validate graph integrity for circular dependencies
    const allWarnings = [...warnings];
    ContextIntegrityValidator.validateGraphIntegrity(
      boundFeatures.map((f) => ({
        featureId: f.featureId,
        dependencies: dependencies.filter((d) => d.sourceFeatureId === f.featureId),
      })),
      allWarnings
    );

    const packageId = `ctx-pkg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const pkg: ContextPackage = {
      packageId,
      generatedAt: Date.now(),
      task: {
        text: request.taskText ?? '',
        intent: request.taskIntent,
      },
      features: boundFeatures,
      resources: selected.resources,
      architecture,
      behavior: selected.behaviorFlows,
      dependencies,
      tests: selected.tests,
      health,
      impact,
      history: selected.milestones,
      warnings: allWarnings,
      selectionReasons: selected.explanations,
      completeness,
      freshness,
      estimatedTokens: allocation.totalUsed,
      version,
      allocation,
    };

    // 5. Sanitize secrets in output package
    ContextIntegrityValidator.sanitizePackage(pkg);

    return pkg;
  }
}
