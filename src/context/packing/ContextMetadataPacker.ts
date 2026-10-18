import type { ContextPlan } from '../models/ContextPlan.js';
import type { SelectedContextData } from '../interfaces/IContextSelector.js';
import type { ContextCompleteness, ContextCompletenessLevel } from '../models/ContextCompleteness.js';
import type { ContextFreshness, ContextFreshnessStatus } from '../models/ContextFreshness.js';
import type { ContextVersion } from '../models/ContextVersion.js';
import type { RetrievedContextData } from '../interfaces/IContextRetriever.js';

export class ContextMetadataPacker {
  public static computeCompleteness(
    plan: ContextPlan,
    selected: SelectedContextData
  ): ContextCompleteness {
    const requested = plan.requiredSections;
    const provided = new Set<string>();

    if (selected.features.length > 0) provided.add('IDENTITY');
    if (selected.resources.length > 0) provided.add('RESOURCES');
    if (selected.features.some((f) => f.entryPoints && f.entryPoints.length > 0)) provided.add('ENTRY_POINTS');
    if (selected.behaviorFlows.length > 0) provided.add('BEHAVIOR');
    if (selected.tests.length > 0) provided.add('TESTS');
    if (selected.risks.length > 0) provided.add('HEALTH');
    if (selected.milestones.length > 0) provided.add('HISTORY');
    if (Object.keys(selected.explanations).length > 0) provided.add('EXPLANATIONS');

    const missingSections: string[] = [];
    const missingReasons: Record<string, string> = {};

    for (const sec of requested) {
      if (!provided.has(sec)) {
        missingSections.push(sec);
        missingReasons[sec] = `Section '${sec}' was requested but no matching data was available or preserved.`;
      }
    }

    const requestedCount = requested.length || 1;
    const providedCount = requested.filter((s) => provided.has(s)).length;
    const score = Number((providedCount / requestedCount).toFixed(2));

    let level: ContextCompletenessLevel = 'FULL';
    if (score < 0.4) level = 'MINIMAL';
    else if (score < 0.75) level = 'PARTIAL';
    else if (score < 0.95) level = 'HIGH';

    return {
      level,
      score,
      requestedSectionsCount: requestedCount,
      providedSectionsCount: providedCount,
      missingSections,
      missingReasons,
    };
  }

  public static computeFreshness(
    retrieved: RetrievedContextData
  ): ContextFreshness {
    let latestUpdate = 0;
    const invalidationReasons: string[] = [];

    for (const [, resp] of retrieved.featureKnowledgeMap.entries()) {
      const ts = resp.profile?.freshness?.lastUpdatedAt ?? resp.metadata?.generatedAt;
      if (typeof ts === 'number' && ts > latestUpdate) {
        latestUpdate = ts;
      }
      if (resp.profile?.freshness?.status === 'STALE') {
        invalidationReasons.push(
          `Feature '${resp.profile.featureId}' marked stale: ${resp.profile.freshness.invalidationReason ?? 'unknown reason'}`
        );
      }
    }

    const now = Date.now();
    const ageMs = latestUpdate > 0 ? now - latestUpdate : 0;
    const isStale = invalidationReasons.length > 0 || (ageMs > 86400000 && latestUpdate > 0);

    let status: ContextFreshnessStatus = 'CURRENT';
    if (isStale) status = 'STALE';
    else if (ageMs > 3600000) status = 'RECENT';

    return {
      status,
      isStale,
      lastUpdatedAt: latestUpdate > 0 ? latestUpdate : now,
      ageMs,
      invalidationReasons,
    };
  }

  public static computeVersion(
    retrieved: RetrievedContextData
  ): ContextVersion {
    let knowledgeVersion = 'unknown';
    const mismatched: string[] = [];

    for (const [, resp] of retrieved.featureKnowledgeMap.entries()) {
      if (resp.metadata?.knowledgeVersion) {
        knowledgeVersion = resp.metadata.knowledgeVersion;
      }
    }

    return {
      packageVersion: '6.10.0',
      knowledgeVersion,
      isConsistent: mismatched.length === 0,
      mismatchedSubsystems: mismatched,
    };
  }
}
