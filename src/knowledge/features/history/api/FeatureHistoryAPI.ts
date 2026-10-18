import type { IFeatureHistoryEngine, BuildHistoryOptions } from '../interfaces/IFeatureHistoryEngine.js';
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

export class FeatureHistoryAPI {
  constructor(
    private engine: IFeatureHistoryEngine,
    private repository?: IFeatureHistoryRepository
  ) {}

  public async buildHistory(
    featureId: string,
    options?: BuildHistoryOptions
  ): Promise<FeatureHistory> {
    return this.engine.buildHistory(featureId, options);
  }

  public async buildHistories(
    featureIds: string[],
    options?: BuildHistoryOptions
  ): Promise<FeatureHistory[]> {
    return this.engine.buildHistories(featureIds, options);
  }

  public async rebuildHistory(
    featureId: string,
    options?: BuildHistoryOptions
  ): Promise<FeatureHistory> {
    return this.engine.rebuildHistory(featureId, options);
  }

  public async updateIncremental(
    events: FeatureHistoryEvent[],
    options?: BuildHistoryOptions
  ): Promise<FeatureHistory[]> {
    return this.engine.updateIncremental(events, options);
  }

  public async getHistory(featureId: string): Promise<FeatureHistory | null> {
    return this.engine.getHistory(featureId);
  }

  public async getTimeline(featureId: string): Promise<FeatureTimeline | null> {
    return this.engine.getTimeline(featureId);
  }

  public async getEvents(featureId: string): Promise<FeatureHistoryEvent[]> {
    return this.engine.getEvents(featureId);
  }

  public async getEvent(featureId: string, eventId: string): Promise<FeatureHistoryEvent | null> {
    return this.engine.getEvent(featureId, eventId);
  }

  public async getSnapshots(featureId: string): Promise<FeatureSnapshot[]> {
    return this.engine.getSnapshots(featureId);
  }

  public async getSnapshot(featureId: string, snapshotId: string): Promise<FeatureSnapshot | null> {
    return this.engine.getSnapshot(featureId, snapshotId);
  }

  public async getMilestones(featureId: string): Promise<FeatureMilestone[]> {
    return this.engine.getMilestones(featureId);
  }

  public async getTrends(featureId: string): Promise<FeatureTrend[]> {
    return this.engine.getTrends(featureId);
  }

  public async getGrowthMetrics(featureId: string): Promise<FeatureGrowthMetrics | null> {
    return this.engine.getGrowthMetrics(featureId);
  }

  public async getMaturity(featureId: string): Promise<FeatureMaturity | null> {
    return this.engine.getMaturity(featureId);
  }

  public async getRegressions(featureId: string): Promise<FeatureRegression[]> {
    return this.engine.getRegressions(featureId);
  }

  public async compareSnapshots(
    featureId: string,
    beforeId: string,
    afterId: string
  ): Promise<FeatureComparison> {
    return this.engine.compareSnapshots(featureId, beforeId, afterId);
  }

  public async compareVersions(
    featureId: string,
    beforeVersion: number,
    afterVersion: number
  ): Promise<FeatureComparison> {
    return this.engine.compareVersions(featureId, beforeVersion, afterVersion);
  }

  public async compareAtTimestamps(
    featureId: string,
    before: number,
    after: number
  ): Promise<FeatureComparison> {
    return this.engine.compareAtTimestamps(featureId, before, after);
  }

  public async explainEvolution(featureId: string): Promise<FeatureEvolutionSummary> {
    return this.engine.explainEvolution(featureId);
  }

  public async getHistoryConflicts(featureId: string): Promise<FeatureHistoryConflict[]> {
    return this.engine.getHistoryConflicts(featureId);
  }

  public async getHistoryRun(runId: string): Promise<FeatureHistory | null> {
    if (!this.repository) return null;
    const all = await this.repository.getAllHistories();
    return all.find((h) => h.historyId === runId) || null;
  }
}
