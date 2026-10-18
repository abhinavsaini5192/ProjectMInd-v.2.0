import type { IFeatureMilestoneDetector } from '../interfaces/IFeatureMilestoneDetector.js';
import type { FeatureHistoryEvent } from '../models/FeatureHistoryEvent.js';
import type { FeatureSnapshot } from '../models/FeatureSnapshot.js';
import type { FeatureMilestone } from '../models/FeatureMilestone.js';
import { FeatureCreatedMilestone } from '../milestones/FeatureCreatedMilestone.js';
import { FeatureDiscoveredMilestone } from '../milestones/FeatureDiscoveredMilestone.js';
import { FeatureActivatedMilestone } from '../milestones/FeatureActivatedMilestone.js';
import { FeatureExpandedMilestone } from '../milestones/FeatureExpandedMilestone.js';
import { FeatureDependencyMilestone } from '../milestones/FeatureDependencyMilestone.js';
import { FeatureBehaviorMilestone } from '../milestones/FeatureBehaviorMilestone.js';
import { FeatureHealthMilestone } from '../milestones/FeatureHealthMilestone.js';
import { FeatureRiskMilestone } from '../milestones/FeatureRiskMilestone.js';
import { FeatureDeprecatedMilestone } from '../milestones/FeatureDeprecatedMilestone.js';
import { FeatureStabilizedMilestone } from '../milestones/FeatureStabilizedMilestone.js';

export class FeatureMilestoneDetector implements IFeatureMilestoneDetector {
  public detectMilestones(
    featureId: string,
    timelineEvents: FeatureHistoryEvent[],
    snapshots: FeatureSnapshot[]
  ): FeatureMilestone[] {
    const milestones: FeatureMilestone[] = [];
    const sortedEvents = [...timelineEvents].sort((a, b) => a.timestamp - b.timestamp);
    const sortedSnapshots = [...snapshots].sort((a, b) => a.timestamp - b.timestamp);

    // 1. Detection from explicit lifecycle events
    const creationEvent = sortedEvents.find((e) => e.eventType === 'FEATURE_CREATED');
    if (creationEvent) {
      milestones.push(
        FeatureCreatedMilestone.create(
          featureId,
          creationEvent.timestamp,
          [creationEvent.eventId],
          creationEvent.evidence[0]?.description || 'Feature initially created'
        )
      );
    }

    const discoveryEvent = sortedEvents.find((e) => e.eventType === 'FEATURE_DISCOVERED');
    if (discoveryEvent) {
      milestones.push(
        FeatureDiscoveredMilestone.create(
          featureId,
          discoveryEvent.timestamp,
          [discoveryEvent.eventId],
          discoveryEvent.evidence[0]?.description || 'Feature discovered in codebase'
        )
      );
    }

    const deprecationEvent = sortedEvents.find((e) => e.eventType === 'FEATURE_DEPRECATED');
    if (deprecationEvent) {
      milestones.push(
        FeatureDeprecatedMilestone.create(
          featureId,
          deprecationEvent.timestamp,
          [deprecationEvent.eventId]
        )
      );
    }

    // 2. Detection from snapshot transitions (evidence-based)
    for (let i = 1; i < sortedSnapshots.length; i++) {
      const prev = sortedSnapshots[i - 1];
      const curr = sortedSnapshots[i];
      if (!prev || !curr) continue;

      // Status activation
      if (prev.status !== 'ACTIVE' && curr.status === 'ACTIVE') {
        milestones.push(FeatureActivatedMilestone.create(featureId, curr.timestamp));
      }

      // Feature expansion: mapped resources jumped or new flows/endpoints
      const resourceGrowth = curr.resourceSummary.resourceCount - prev.resourceSummary.resourceCount;
      const flowsAdded = curr.behaviorSummary.flows.filter((f) => !prev.behaviorSummary.flows.includes(f));
      const endpointsAdded = curr.behaviorSummary.entryPoints.filter(
        (ep) => !prev.behaviorSummary.entryPoints.includes(ep)
      );

      if (resourceGrowth >= 2 || flowsAdded.length >= 1 || endpointsAdded.length >= 1) {
        milestones.push(
          FeatureExpandedMilestone.create(
            featureId,
            curr.timestamp,
            [],
            `Feature expanded with ${flowsAdded.length} new flows, ${endpointsAdded.length} endpoints, +${resourceGrowth} resources`
          )
        );
      }

      // First dependent feature added
      const newDependents = curr.dependencySummary.dependents.filter(
        (d) => !prev.dependencySummary.dependents.includes(d)
      );
      if (prev.dependencySummary.dependentCount === 0 && curr.dependencySummary.dependentCount > 0) {
        milestones.push(
          FeatureDependencyMilestone.create(
            featureId,
            curr.timestamp,
            [],
            `First dependent feature added (${newDependents.join(', ') || 'external feature'})`
          )
        );
      } else if (newDependents.length > 0) {
        milestones.push(
          FeatureDependencyMilestone.create(
            featureId,
            curr.timestamp,
            [],
            `New dependent features added: ${newDependents.join(', ')}`
          )
        );
      }

      // Major behavior flow addition (e.g. OAuth flow)
      if (flowsAdded.length > 0) {
        milestones.push(
          FeatureBehaviorMilestone.create(
            featureId,
            curr.timestamp,
            [],
            `Behavior expanded: ${flowsAdded.join(', ')}`
          )
        );
      }

      // Significant health improvement (+15 points or more)
      if (curr.healthSummary.score >= prev.healthSummary.score + 15) {
        milestones.push(
          FeatureHealthMilestone.create(
            featureId,
            curr.timestamp,
            [],
            `Health improved from ${prev.healthSummary.score} to ${curr.healthSummary.score}`
          )
        );
      }

      // Significant risk changes (+15 points increase, or -15 points reduction)
      if (curr.riskSummary.score >= prev.riskSummary.score + 15) {
        milestones.push(
          FeatureRiskMilestone.create(
            featureId,
            curr.timestamp,
            false,
            [],
            `Risk elevated from ${prev.riskSummary.score} to ${curr.riskSummary.score}`
          )
        );
      } else if (curr.riskSummary.score <= prev.riskSummary.score - 15) {
        milestones.push(
          FeatureRiskMilestone.create(
            featureId,
            curr.timestamp,
            true,
            [],
            `Risk reduced from ${prev.riskSummary.score} to ${curr.riskSummary.score}`
          )
        );
      }
    }

    // 3. Stabilization Milestone: requires multiple observations (>= 3 snapshots)
    // with stable mappings, high health (>= 75), low risk (<= 30), and no regressions
    if (sortedSnapshots.length >= 3) {
      const recent = sortedSnapshots.slice(-3);
      const isConsistentMapping =
        recent.every((s) => s.mappingSummary.mappedCount === recent[0]?.mappingSummary.mappedCount);
      const isHighHealth = recent.every((s) => s.healthSummary.score >= 70);
      const isLowRisk = recent.every((s) => s.riskSummary.score <= 35);

      if (isConsistentMapping && isHighHealth && isLowRisk) {
        const last = sortedSnapshots[sortedSnapshots.length - 1];
        if (last) {
          milestones.push(
            FeatureStabilizedMilestone.create(
              featureId,
              last.timestamp,
              [],
              'Feature stabilized over multiple snapshots with consistent mappings and solid health'
            )
          );
        }
      }
    }

    // Deduplicate milestones with the same milestoneType and timestamp
    const seen = new Set<string>();
    const deduped: FeatureMilestone[] = [];
    for (const ms of milestones) {
      const key = `${ms.milestoneType}_${ms.timestamp}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(ms);
      }
    }

    return deduped.sort((a, b) => a.timestamp - b.timestamp);
  }
}
