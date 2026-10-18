import type {
  IFeatureHistoryEngine,
  BuildHistoryOptions,
} from '../interfaces/IFeatureHistoryEngine.js';
import type { IFeatureHistoryRepository } from '../interfaces/IFeatureHistoryRepository.js';
import type { FeatureHistory } from '../models/FeatureHistory.js';
import type { FeatureTimeline } from '../models/FeatureTimeline.js';
import type { FeatureHistoryEvent } from '../models/FeatureHistoryEvent.js';
import type { FeatureSnapshot } from '../models/FeatureSnapshot.js';
import type { FeatureMilestone } from '../models/FeatureMilestone.js';
import type { FeatureTrend } from '../models/FeatureTrend.js';
import type { FeatureGrowthMetrics } from '../models/FeatureGrowthMetrics.js';
import type { FeatureMaturity } from '../models/FeatureMaturity.js';
import type { FeatureRegression } from '../models/FeatureRegression.js';
import type { FeatureComparison } from '../models/FeatureComparison.js';
import type { FeatureEvolutionSummary } from '../models/FeatureEvolutionSummary.js';
import type { FeatureHistoryConflict } from '../models/FeatureHistoryConflict.js';
import { FeatureHistoryCoordinator } from './FeatureHistoryCoordinator.js';
import { FeatureHistoryAnalyzer } from './FeatureHistoryAnalyzer.js';
import { FeatureHistoryExplainer } from './FeatureHistoryExplainer.js';
import { FeatureHistoryEvents } from '../events/FeatureHistoryEvents.js';
import type { IEventBus } from '../../../../workspace/interfaces/IEventBus.js';
import {
  FeatureHistoryError,
  InvalidHistoryReferenceError,
} from '../errors/index.js';

export interface EngineDependencies {
  coordinator?: FeatureHistoryCoordinator;
  analyzer?: FeatureHistoryAnalyzer;
  explainer?: FeatureHistoryExplainer;
  eventBus?: IEventBus;
}

export class FeatureHistoryEngine implements IFeatureHistoryEngine {
  private repository?: IFeatureHistoryRepository | undefined;
  private coordinator: FeatureHistoryCoordinator;
  private analyzer: FeatureHistoryAnalyzer;
  private explainer: FeatureHistoryExplainer;
  private eventBus?: IEventBus | undefined;

  // In-memory cache
  private cache = new Map<string, FeatureHistory>();

  constructor(repository?: IFeatureHistoryRepository, deps: EngineDependencies = {}) {
    this.repository = repository;
    this.coordinator = deps.coordinator || new FeatureHistoryCoordinator();
    this.analyzer = deps.analyzer || new FeatureHistoryAnalyzer();
    this.explainer = deps.explainer || new FeatureHistoryExplainer();
    this.eventBus = deps.eventBus;
  }

  public async buildHistory(
    featureId: string,
    options: BuildHistoryOptions = {}
  ): Promise<FeatureHistory> {
    if (!featureId || typeof featureId !== 'string') {
      throw new InvalidHistoryReferenceError('Invalid featureId provided');
    }

    const cacheKey = `${featureId}:${options.knowledgeVersion || 'default'}`;
    if (!options.forceRebuild && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // 1. Fetch existing stored snapshots from repo if available
    const existingSnapshots = this.repository
      ? await this.repository.getSnapshots(featureId)
      : [];

    // 2. Fetch existing stored events from repo if available
    const existingEvents = this.repository
      ? await this.repository.getEvents(featureId)
      : [];

    // 3. Collect new events from coordinator sources
    const collectedEvents = await this.coordinator.collectEvents({
      featureId,
      workspaceId: options.workspaceId,
      repositoryId: options.repositoryId,
      knowledgeVersion: options.knowledgeVersion,
    });

    // Merge and deduplicate events
    const allEventsMap = new Map<string, FeatureHistoryEvent>();
    for (const ev of [...existingEvents, ...collectedEvents]) {
      allEventsMap.set(ev.eventId, ev);
    }
    const mergedEvents = Array.from(allEventsMap.values());

    // 4. Analyze and build history
    const { history, conflicts } = this.analyzer.analyze(
      featureId,
      mergedEvents,
      existingSnapshots,
      options
    );

    // 5. Persist to repository if available
    if (this.repository) {
      await this.repository.saveHistory(history);
      await this.repository.saveEvents(mergedEvents);
      if (conflicts.length > 0) {
        await this.repository.saveConflicts(conflicts);
      }
    }

    // 6. Cache history
    this.cache.set(cacheKey, history);

    // 7. Publish events
    this.publishEvent(FeatureHistoryEvents.HistoryBuilt, {
      featureId,
      historyId: history.historyId,
      eventCount: history.timeline.eventCount,
      milestoneCount: history.milestones.length,
    });

    for (const ms of history.milestones) {
      this.publishEvent(FeatureHistoryEvents.MilestoneDetected, {
        featureId,
        milestoneId: ms.milestoneId,
        milestoneType: ms.milestoneType,
      });
    }

    for (const reg of history.regressions) {
      this.publishEvent(FeatureHistoryEvents.RegressionDetected, {
        featureId,
        regressionId: reg.regressionId,
        regressionType: reg.regressionType,
      });
    }

    for (const c of conflicts) {
      this.publishEvent(FeatureHistoryEvents.ConflictDetected, {
        featureId,
        conflictId: c.conflictId,
        conflictType: c.conflictType,
      });
    }

    return history;
  }

  public async buildHistories(
    featureIds: string[],
    options: BuildHistoryOptions = {}
  ): Promise<FeatureHistory[]> {
    const results: FeatureHistory[] = [];
    for (const fid of featureIds) {
      results.push(await this.buildHistory(fid, options));
    }
    return results;
  }

  public async rebuildHistory(
    featureId: string,
    options: BuildHistoryOptions = {}
  ): Promise<FeatureHistory> {
    this.cache.delete(`${featureId}:${options.knowledgeVersion || 'default'}`);
    return this.buildHistory(featureId, { ...options, forceRebuild: true });
  }

  public async updateIncremental(
    events: FeatureHistoryEvent[],
    options: BuildHistoryOptions = {}
  ): Promise<FeatureHistory[]> {
    // Group incoming events by featureId
    const eventsByFeature = new Map<string, FeatureHistoryEvent[]>();
    for (const ev of events) {
      const list = eventsByFeature.get(ev.featureId) || [];
      list.push(ev);
      eventsByFeature.set(ev.featureId, list);
    }

    const updatedHistories: FeatureHistory[] = [];

    for (const [fid, evs] of eventsByFeature.entries()) {
      // Invalidate cache for this feature
      this.cache.delete(`${fid}:${options.knowledgeVersion || 'default'}`);

      if (this.repository) {
        await this.repository.saveEvents(evs);
      }

      const updated = await this.buildHistory(fid, {
        ...options,
        analysisMode: 'INCREMENTAL',
        forceRebuild: true,
      });

      this.publishEvent(FeatureHistoryEvents.IncrementalUpdated, {
        featureId: fid,
        newEventCount: evs.length,
      });

      updatedHistories.push(updated);
    }

    return updatedHistories;
  }

  public async getHistory(featureId: string): Promise<FeatureHistory | null> {
    for (const [k, v] of this.cache.entries()) {
      if (k.startsWith(`${featureId}:`)) return v;
    }
    if (this.repository) {
      return this.repository.getHistory(featureId);
    }
    return null;
  }

  public async getTimeline(featureId: string): Promise<FeatureTimeline | null> {
    const hist = await this.getHistory(featureId);
    return hist ? hist.timeline : null;
  }

  public async getEvents(featureId: string): Promise<FeatureHistoryEvent[]> {
    const hist = await this.getHistory(featureId);
    if (hist) return hist.timeline.events;
    if (this.repository) return this.repository.getEvents(featureId);
    return [];
  }

  public async getEvent(featureId: string, eventId: string): Promise<FeatureHistoryEvent | null> {
    const events = await this.getEvents(featureId);
    return events.find((e) => e.eventId === eventId) || null;
  }

  public async getSnapshots(featureId: string): Promise<FeatureSnapshot[]> {
    const hist = await this.getHistory(featureId);
    if (hist) return hist.snapshots;
    if (this.repository) return this.repository.getSnapshots(featureId);
    return [];
  }

  public async getSnapshot(featureId: string, snapshotId: string): Promise<FeatureSnapshot | null> {
    const snaps = await this.getSnapshots(featureId);
    return snaps.find((s) => s.snapshotId === snapshotId) || null;
  }

  public async getMilestones(featureId: string): Promise<FeatureMilestone[]> {
    const hist = await this.getHistory(featureId);
    return hist ? hist.milestones : [];
  }

  public async getTrends(featureId: string): Promise<FeatureTrend[]> {
    const hist = await this.getHistory(featureId);
    return hist ? hist.trends : [];
  }

  public async getGrowthMetrics(featureId: string): Promise<FeatureGrowthMetrics | null> {
    const hist = await this.getHistory(featureId);
    return hist ? hist.growthMetrics : null;
  }

  public async getMaturity(featureId: string): Promise<FeatureMaturity | null> {
    const hist = await this.getHistory(featureId);
    return hist ? hist.maturity : null;
  }

  public async getRegressions(featureId: string): Promise<FeatureRegression[]> {
    const hist = await this.getHistory(featureId);
    return hist ? hist.regressions : [];
  }

  public async compareSnapshots(
    featureId: string,
    beforeId: string,
    afterId: string
  ): Promise<FeatureComparison> {
    const before = await this.getSnapshot(featureId, beforeId);
    const after = await this.getSnapshot(featureId, afterId);

    if (!before || !after) {
      throw new InvalidHistoryReferenceError(
        `Snapshot not found for comparison: beforeId=${beforeId}, afterId=${afterId}`
      );
    }

    return this.explainer.compareSnapshots(featureId, before, after);
  }

  public async compareVersions(
    featureId: string,
    beforeVersion: number,
    afterVersion: number
  ): Promise<FeatureComparison> {
    const snapshots = await this.getSnapshots(featureId);
    const before = snapshots.find((s) => s.version === beforeVersion);
    const after = snapshots.find((s) => s.version === afterVersion);

    if (!before || !after) {
      throw new InvalidHistoryReferenceError(
        `Version snapshots not found for comparison: ${beforeVersion} vs ${afterVersion}`
      );
    }

    return this.explainer.compareSnapshots(featureId, before, after);
  }

  public async compareAtTimestamps(
    featureId: string,
    beforeTime: number,
    afterTime: number
  ): Promise<FeatureComparison> {
    const snapshots = await this.getSnapshots(featureId);
    const sorted = [...snapshots].sort((a, b) => a.timestamp - b.timestamp);

    const before = sorted.filter((s) => s.timestamp <= beforeTime).pop();
    const after = sorted.filter((s) => s.timestamp <= afterTime).pop();

    if (!before || !after) {
      throw new InvalidHistoryReferenceError(
        `No snapshots available at timestamps: ${beforeTime} and ${afterTime}`
      );
    }

    return this.explainer.compareSnapshots(featureId, before, after);
  }

  public async explainEvolution(featureId: string): Promise<FeatureEvolutionSummary> {
    let hist = await this.getHistory(featureId);
    if (!hist) {
      hist = await this.buildHistory(featureId);
    }
    return this.explainer.explainEvolution(featureId, hist);
  }

  public async getHistoryConflicts(featureId: string): Promise<FeatureHistoryConflict[]> {
    if (this.repository) {
      return this.repository.getConflicts(featureId);
    }
    return [];
  }

  public getExplainer(): FeatureHistoryExplainer {
    return this.explainer;
  }

  public getCoordinator(): FeatureHistoryCoordinator {
    return this.coordinator;
  }

  private publishEvent(eventName: string, payload: any): void {
    if (this.eventBus) {
      try {
        this.eventBus.publish(eventName, payload);
      } catch (err) {
        console.warn(`[FeatureHistoryEngine] Event publication error (${eventName}):`, err);
      }
    }
  }
}
