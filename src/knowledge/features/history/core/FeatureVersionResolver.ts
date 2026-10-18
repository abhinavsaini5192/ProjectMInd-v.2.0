import type { IFeatureVersionResolver } from '../interfaces/IFeatureVersionResolver.js';
import type { FeatureTimeline } from '../models/FeatureTimeline.js';
import type { FeatureSnapshot } from '../models/FeatureSnapshot.js';
import type { FeatureVersionSnapshot } from '../models/FeatureVersionSnapshot.js';

export class FeatureVersionResolver implements IFeatureVersionResolver {
  public resolveVersions(
    featureId: string,
    timeline: FeatureTimeline,
    snapshots: FeatureSnapshot[]
  ): FeatureVersionSnapshot[] {
    if (snapshots.length === 0) {
      return [];
    }

    const sortedSnapshots = [...snapshots].sort((a, b) => a.timestamp - b.timestamp);
    const versionSnapshots: FeatureVersionSnapshot[] = [];

    // Always create version 1 for the first snapshot
    const firstSnap = sortedSnapshots[0];
    if (!firstSnap) {
      return [];
    }

    versionSnapshots.push({
      versionId: `v1_${featureId}`,
      featureId,
      semanticVersion: 1,
      snapshotId: firstSnap.snapshotId,
      snapshot: firstSnap,
      reason: 'Initial feature discovery',
      timestamp: firstSnap.timestamp,
      isMajor: true,
    });

    let currentVersion = 1;
    let previousSnap = firstSnap;

    for (let i = 1; i < sortedSnapshots.length; i++) {
      const snap = sortedSnapshots[i];
      if (!snap) continue;

      const { isMeaningful, reason, isMajor } = this.evaluateSnapshotChange(previousSnap, snap);

      if (isMeaningful) {
        currentVersion++;
        versionSnapshots.push({
          versionId: `v${currentVersion}_${featureId}`,
          featureId,
          semanticVersion: currentVersion,
          snapshotId: snap.snapshotId,
          snapshot: snap,
          reason,
          timestamp: snap.timestamp,
          isMajor,
        });
        previousSnap = snap;
      }
    }

    return versionSnapshots;
  }

  private evaluateSnapshotChange(
    prev: FeatureSnapshot,
    next: FeatureSnapshot
  ): { isMeaningful: boolean; reason: string; isMajor: boolean } {
    // 1. Status change
    if (prev.status !== next.status) {
      return {
        isMeaningful: true,
        reason: `Status transitioned from ${prev.status} to ${next.status}`,
        isMajor: true,
      };
    }

    // 2. Entry points change
    const entryPointsAdded = next.behaviorSummary.entryPoints.filter(
      (ep) => !prev.behaviorSummary.entryPoints.includes(ep)
    );
    if (entryPointsAdded.length > 0) {
      return {
        isMeaningful: true,
        reason: `New entry point(s) added: ${entryPointsAdded.join(', ')}`,
        isMajor: true,
      };
    }

    // 3. Behavior flows change
    const flowsAdded = next.behaviorSummary.flows.filter(
      (f) => !prev.behaviorSummary.flows.includes(f)
    );
    if (flowsAdded.length > 0) {
      return {
        isMeaningful: true,
        reason: `Behavior expanded with new flow(s): ${flowsAdded.join(', ')}`,
        isMajor: false,
      };
    }

    // 4. Dependencies change
    const depsAdded = next.dependencySummary.dependencies.filter(
      (d) => !prev.dependencySummary.dependencies.includes(d)
    );
    const dependentsAdded = next.dependencySummary.dependents.filter(
      (d) => !prev.dependencySummary.dependents.includes(d)
    );
    if (depsAdded.length > 0 || dependentsAdded.length > 0) {
      return {
        isMeaningful: true,
        reason: `Dependency topology evolved: added deps [${depsAdded.join(', ')}], dependents [${dependentsAdded.join(', ')}]`,
        isMajor: dependentsAdded.length > 0,
      };
    }

    // 5. Criticality change
    if (prev.criticalitySummary.level !== next.criticalitySummary.level) {
      return {
        isMeaningful: true,
        reason: `Criticality shifted from ${prev.criticalitySummary.level} to ${next.criticalitySummary.level}`,
        isMajor: true,
      };
    }

    // 6. Major health or risk score jump (>= 20 points)
    const healthDelta = Math.abs(next.healthSummary.score - prev.healthSummary.score);
    const riskDelta = Math.abs(next.riskSummary.score - prev.riskSummary.score);
    if (healthDelta >= 20 || riskDelta >= 20) {
      return {
        isMeaningful: true,
        reason: `Significant health/risk delta (health: ${healthDelta}, risk: ${riskDelta})`,
        isMajor: false,
      };
    }

    // 7. Significant resource count change (>= 2 resources)
    const resourceDiff = Math.abs(
      next.resourceSummary.resourceCount - prev.resourceSummary.resourceCount
    );
    if (resourceDiff >= 2) {
      return {
        isMeaningful: true,
        reason: `Substantial implementation change (${resourceDiff} resources modified/added)`,
        isMajor: false,
      };
    }

    return { isMeaningful: false, reason: 'Minor or technical change', isMajor: false };
  }
}
