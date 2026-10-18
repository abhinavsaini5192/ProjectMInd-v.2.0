import type {
  IFeatureKnowledgeFreshnessResolver,
  FreshnessEvaluation,
} from '../interfaces/IFeatureKnowledgeFreshnessResolver.js';
import type { ResolvedRawSections } from '../interfaces/IFeatureKnowledgeResolver.js';
import type { FeatureKnowledgeQuery } from '../models/FeatureKnowledgeQuery.js';
import type { FreshnessStatus, FeatureKnowledgeFreshness } from '../models/FeatureKnowledgeFreshness.js';
import type { VersionConsistencyStatus, FeatureKnowledgeVersion } from '../models/FeatureKnowledgeVersion.js';

export class FeatureKnowledgeFreshnessResolver implements IFeatureKnowledgeFreshnessResolver {
  public evaluateFreshness(
    sections: ResolvedRawSections,
    query: FeatureKnowledgeQuery
  ): FreshnessEvaluation {
    const sectionEntries = Object.entries(sections) as [string, any][];
    const sectionVersions: Record<string, string> = {};
    const mismatches: string[] = [];
    let maxTimestamp: number | undefined = undefined;
    let anyStaleSection = false;

    for (const [sectionName, sectionData] of sectionEntries) {
      if (!sectionData || sectionData.status === 'NOT_REQUESTED') {
        continue;
      }

      if (sectionData.lastUpdatedAt && typeof sectionData.lastUpdatedAt === 'number') {
        if (maxTimestamp === undefined || sectionData.lastUpdatedAt > maxTimestamp) {
          maxTimestamp = sectionData.lastUpdatedAt;
        }
      }

      if (sectionData.status === 'STALE') {
        anyStaleSection = true;
      }

      if (sectionData.knowledgeVersion) {
        sectionVersions[sectionName] = sectionData.knowledgeVersion;
      }
    }

    // Determine version consistency
    const versions = Object.values(sectionVersions);
    const uniqueVersions = Array.from(new Set(versions));

    let consistencyStatus: VersionConsistencyStatus = 'UNKNOWN';
    let aggregateVersion = query.knowledgeVersion ?? '1.0.0';

    if (uniqueVersions.length === 1 && uniqueVersions[0]) {
      consistencyStatus = 'CONSISTENT';
      aggregateVersion = uniqueVersions[0];
    } else if (uniqueVersions.length > 1) {
      consistencyStatus = 'PARTIALLY_CONSISTENT';
      aggregateVersion = uniqueVersions[0] ?? '1.0.0';

      // Record mismatches between sections
      const baseVer = uniqueVersions[0];
      for (const [sec, ver] of Object.entries(sectionVersions)) {
        if (ver !== baseVer) {
          mismatches.push(`${sec} has version ${ver} (expected ${baseVer})`);
        }
      }
    }

    // Check against query.knowledgeVersion if provided
    let versionMismatchWithQuery = false;
    if (query.knowledgeVersion) {
      for (const [sec, ver] of Object.entries(sectionVersions)) {
        if (ver !== query.knowledgeVersion) {
          versionMismatchWithQuery = true;
          mismatches.push(
            `${sec} version (${ver}) mismatches requested query version (${query.knowledgeVersion})`
          );
        }
      }
      if (versionMismatchWithQuery) {
        consistencyStatus = 'INCONSISTENT';
      }
    }

    const versionStatus: FeatureKnowledgeVersion = {
      aggregateVersion,
      consistencyStatus,
      sectionVersions,
      mismatches,
    };

    // Determine Freshness Status
    let freshnessStatus: FreshnessStatus = 'UNKNOWN';
    const now = Date.now();
    const ageMs = maxTimestamp !== undefined ? Math.max(0, now - maxTimestamp) : undefined;

    if (versionMismatchWithQuery) {
      freshnessStatus = 'VERSION_MISMATCH';
    } else if (anyStaleSection) {
      freshnessStatus = 'STALE';
    } else if (maxTimestamp !== undefined) {
      // Within 1 hour: CURRENT; within 24 hours: RECENT; older: STALE
      if (ageMs !== undefined && ageMs < 3600000) {
        freshnessStatus = 'CURRENT';
      } else if (ageMs !== undefined && ageMs < 86400000) {
        freshnessStatus = 'RECENT';
      } else {
        freshnessStatus = 'STALE';
      }
    } else if (Object.keys(sectionVersions).length > 0) {
      freshnessStatus = 'CURRENT';
    }

    const freshness: FeatureKnowledgeFreshness = {
      status: freshnessStatus,
      lastUpdatedAt: maxTimestamp,
      sourceKnowledgeVersion: aggregateVersion,
      ageMs,
      invalidationReason: anyStaleSection
        ? 'One or more sections contain stale knowledge'
        : versionMismatchWithQuery
          ? 'Version mismatch detected against requested knowledge version'
          : undefined,
    };

    return {
      freshness,
      versionStatus,
    };
  }
}
