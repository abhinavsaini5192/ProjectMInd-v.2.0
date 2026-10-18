import type { FeatureHistory } from '../models/FeatureHistory.js';
import type { FeatureSnapshot } from '../models/FeatureSnapshot.js';
import type { FeatureHistoryEvent } from '../models/FeatureHistoryEvent.js';
import type { FeatureHistoryConflict } from '../models/FeatureHistoryConflict.js';
import { FeatureHistoryNormalizer } from './FeatureHistoryNormalizer.js';
import { FeatureEvolutionBuilder } from './FeatureEvolutionBuilder.js';
import { FeatureMilestoneDetector } from './FeatureMilestoneDetector.js';
import { FeatureTimelineAggregator } from './FeatureTimelineAggregator.js';
import { FeatureTrendAnalyzer } from './FeatureTrendAnalyzer.js';
import { FeatureVersionResolver } from './FeatureVersionResolver.js';
import { createHistoryConfidence } from '../models/FeatureHistoryConfidence.js';

export interface AnalyzerDependencies {
  evolutionBuilder?: FeatureEvolutionBuilder;
  milestoneDetector?: FeatureMilestoneDetector;
  timelineAggregator?: FeatureTimelineAggregator;
  trendAnalyzer?: FeatureTrendAnalyzer;
  versionResolver?: FeatureVersionResolver;
}

export interface AnalysisResult {
  history: FeatureHistory;
  conflicts: FeatureHistoryConflict[];
}

export class FeatureHistoryAnalyzer {
  private evolutionBuilder: FeatureEvolutionBuilder;
  private milestoneDetector: FeatureMilestoneDetector;
  private timelineAggregator: FeatureTimelineAggregator;
  private trendAnalyzer: FeatureTrendAnalyzer;
  private versionResolver: FeatureVersionResolver;

  constructor(deps: AnalyzerDependencies = {}) {
    this.evolutionBuilder = deps.evolutionBuilder || new FeatureEvolutionBuilder();
    this.milestoneDetector = deps.milestoneDetector || new FeatureMilestoneDetector();
    this.timelineAggregator = deps.timelineAggregator || new FeatureTimelineAggregator();
    this.trendAnalyzer = deps.trendAnalyzer || new FeatureTrendAnalyzer();
    this.versionResolver = deps.versionResolver || new FeatureVersionResolver();
  }

  public analyze(
    featureId: string,
    rawEvents: FeatureHistoryEvent[],
    snapshots: FeatureSnapshot[],
    options: {
      workspaceId?: string;
      repositoryId?: string;
      knowledgeVersion?: string;
    } = {}
  ): AnalysisResult {
    // 1. Normalize and detect conflicts
    const { events: normalizedEvents, conflicts } = FeatureHistoryNormalizer.normalize(
      featureId,
      rawEvents
    );

    // 2. Build grouped evolution events (episodes)
    const evolutionEvents = this.evolutionBuilder.buildEvolutionEvents(featureId, normalizedEvents);

    // 3. Detect evidence-based milestones
    const milestones = this.milestoneDetector.detectMilestones(featureId, normalizedEvents, snapshots);

    // 4. Aggregate timeline
    const timeline = this.timelineAggregator.aggregateTimeline(
      featureId,
      normalizedEvents,
      evolutionEvents,
      milestones
    );

    // 5. Compute growth metrics, trends, maturity, regressions
    const growthMetrics = this.trendAnalyzer.calculateGrowthMetrics(featureId, snapshots);
    const trends = this.trendAnalyzer.analyzeTrends(featureId, snapshots, timeline);
    const maturity = this.trendAnalyzer.determineMaturity(featureId, snapshots, trends);
    const regressions = this.trendAnalyzer.detectRegressions(featureId, snapshots);

    // 6. Resolve version snapshots
    const versionSnapshots = this.versionResolver.resolveVersions(featureId, timeline, snapshots);
    const currentVersion = versionSnapshots.length > 0 ? versionSnapshots[versionSnapshots.length - 1]?.semanticVersion ?? 1 : 1;

    // 7. Derive current state snapshot
    const sortedSnapshots = [...snapshots].sort((a, b) => a.timestamp - b.timestamp);
    const currentState = sortedSnapshots[sortedSnapshots.length - 1] || this.createDefaultSnapshot(featureId, timeline.endTime);

    // 8. Determine overall confidence
    const firstSeenAt = timeline.startTime || Date.now();
    const lastUpdatedAt = timeline.endTime || firstSeenAt;

    let overallConfidence = timeline.confidence;
    if (sortedSnapshots.length === 0) {
      overallConfidence = createHistoryConfidence(
        'LOW',
        0.3,
        ['Incomplete history: no recorded feature snapshots available']
      );
    } else if (sortedSnapshots.length === 1 && overallConfidence.score > 0.6) {
      overallConfidence = createHistoryConfidence(
        'MEDIUM',
        0.6,
        ['Single snapshot history: limited longitudinal observations']
      );
    }

    const history: FeatureHistory = {
      historyId: `hist_${featureId}`,
      featureId,
      workspaceId: options.workspaceId || 'ws_default',
      repositoryId: options.repositoryId || 'repo_default',
      firstSeenAt,
      lastUpdatedAt,
      currentVersion,
      timeline,
      snapshots: sortedSnapshots,
      evolutionEvents,
      milestones,
      trends,
      growthMetrics,
      maturity,
      regressions,
      currentState,
      confidence: overallConfidence,
      knowledgeVersion: options.knowledgeVersion || '1.0.0',
      historyVersion: 1,
      active: currentState.status === 'ACTIVE',
      createdAt: firstSeenAt,
      updatedAt: lastUpdatedAt,
    };

    return { history, conflicts };
  }

  private createDefaultSnapshot(featureId: string, timestamp: number): FeatureSnapshot {
    return {
      snapshotId: `snap_${featureId}_initial`,
      featureId,
      timestamp,
      version: 1,
      metadata: { name: featureId },
      resourceSummary: { resourceCount: 0, resources: [] },
      mappingSummary: { mappedCount: 0, roles: {} },
      dependencySummary: { dependencyCount: 0, dependentCount: 0, dependencies: [], dependents: [] },
      behaviorSummary: { flowCount: 0, entryPointCount: 0, flows: [], entryPoints: [] },
      healthSummary: { score: 50, status: 'UNKNOWN' },
      riskSummary: { score: 20, riskCount: 0 },
      criticalitySummary: { score: 25, level: 'LOW' },
      architectureSummary: {},
      status: 'ACTIVE',
      confidence: createHistoryConfidence('MEDIUM', 0.5, ['Default synthesized snapshot']),
      knowledgeVersion: '1.0.0',
    };
  }
}
