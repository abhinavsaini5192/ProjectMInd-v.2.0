import type { VerificationRecord } from '../models/VerificationRecord.js';
import type {
  VerificationFreshness,
  VerificationFreshnessStatus,
} from '../models/VerificationFreshness.js';
import type {
  IVerificationFreshnessEvaluator,
  FreshnessEvaluationParams,
} from '../interfaces/IVerificationFreshnessEvaluator.js';

export class VerificationFreshnessEvaluator implements IVerificationFreshnessEvaluator {
  private static readonly DOC_EXTENSIONS = new Set(['.md', '.txt', '.rst', '.adoc']);

  public evaluateFreshness(
    record: VerificationRecord,
    params?: FreshnessEvaluationParams | undefined
  ): VerificationFreshness {
    const evaluatedAt = new Date().toISOString();

    if (!params) {
      return {
        status: 'CURRENT',
        evaluatedAt,
      };
    }

    const { currentRepositoryState, modifiedFiles, changedFeatures, activeChangeSetId } = params;

    // 1. Exact repository state binding match
    if (
      record.repositoryState.status === 'BOUND' &&
      currentRepositoryState &&
      currentRepositoryState.status === 'BOUND'
    ) {
      if (
        record.repositoryState.commitId &&
        currentRepositoryState.commitId &&
        record.repositoryState.commitId === currentRepositoryState.commitId
      ) {
        return { status: 'CURRENT', evaluatedAt };
      }

      if (
        record.repositoryState.workingTreeHash &&
        currentRepositoryState.workingTreeHash &&
        record.repositoryState.workingTreeHash === currentRepositoryState.workingTreeHash
      ) {
        return { status: 'CURRENT', evaluatedAt };
      }
    }

    // 2. ChangeSet ID match
    if (
      record.repositoryState.changeSetId &&
      activeChangeSetId &&
      record.repositoryState.changeSetId === activeChangeSetId
    ) {
      return { status: 'CURRENT', evaluatedAt };
    }

    // 3. Check feature intersection if changedFeatures provided
    if (record.scope.featureIds && changedFeatures && changedFeatures.length > 0) {
      const featSet = new Set(changedFeatures);
      const intersectedFeatures = record.scope.featureIds.filter((f) => featSet.has(f));
      if (intersectedFeatures.length > 0) {
        return {
          status: 'STALE',
          staleReason: `Verified features were affected by changes: ${intersectedFeatures.join(', ')}`,
          evaluatedAt,
          invalidatedBy: intersectedFeatures,
        };
      }
    }

    // 4. Smart Freshness Check based on modified files
    if (modifiedFiles && modifiedFiles.length > 0) {
      const targetFiles = record.scope.targetFiles ?? [];
      const normalizedTargets = targetFiles.map((f) => f.replace(/\\/g, '/').toLowerCase());
      const normalizedModified = modifiedFiles.map((f) => f.replace(/\\/g, '/').toLowerCase());

      // Check direct intersection with verification target files
      const invalidatedFiles = normalizedModified.filter((mod) =>
        normalizedTargets.some((tgt) => tgt === mod || mod.endsWith(tgt) || tgt.endsWith(mod))
      );

      if (invalidatedFiles.length > 0) {
        return {
          status: 'STALE',
          staleReason: `Verified resources were modified: ${invalidatedFiles.join(', ')}`,
          evaluatedAt,
          invalidatedBy: invalidatedFiles,
        };
      }


      // Scope-level reasoning:
      // If verification is REPOSITORY or WORKSPACE scoped, check if modifications are code files
      if (record.scope.scopeType === 'REPOSITORY' || record.scope.scopeType === 'WORKSPACE') {
        const hasCodeChanges = normalizedModified.some((file) => {
          const isDoc = Array.from(VerificationFreshnessEvaluator.DOC_EXTENSIONS).some((ext) =>
            file.endsWith(ext)
          );
          return !isDoc;
        });

        if (hasCodeChanges) {
          return {
            status: 'STALE',
            staleReason: 'Repository-scoped verification is stale due to code modifications',
            evaluatedAt,
            invalidatedBy: normalizedModified,
          };
        }
      }

      // If changes were purely unrelated files (e.g. README.md or different modules), remain CURRENT
      return {
        status: 'CURRENT',
        evaluatedAt,
      };
    }

    // 4. Fallback if repo state changed but no specific files provided
    if (
      record.repositoryState.status === 'BOUND' &&
      currentRepositoryState &&
      currentRepositoryState.commitId &&
      record.repositoryState.commitId &&
      record.repositoryState.commitId !== currentRepositoryState.commitId
    ) {
      return {
        status: 'STALE',
        staleReason: `Repository commit changed from ${record.repositoryState.commitId} to ${currentRepositoryState.commitId}`,
        evaluatedAt,
      };
    }

    return {
      status: 'CURRENT',
      evaluatedAt,
    };
  }
}
