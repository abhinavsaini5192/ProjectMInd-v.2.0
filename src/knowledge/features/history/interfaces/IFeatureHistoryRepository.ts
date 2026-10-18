import type { FeatureHistory } from '../models/FeatureHistory.js';
import type { FeatureSnapshot } from '../models/FeatureSnapshot.js';
import type { FeatureHistoryEvent } from '../models/FeatureHistoryEvent.js';
import type { FeatureHistoryConflict } from '../models/FeatureHistoryConflict.js';

export interface IFeatureHistoryRepository {
  saveHistory(history: FeatureHistory): Promise<void>;
  getHistory(featureId: string): Promise<FeatureHistory | null>;
  getAllHistories(): Promise<FeatureHistory[]>;
  deleteHistory(featureId: string): Promise<boolean>;

  saveSnapshot(snapshot: FeatureSnapshot): Promise<void>;
  getSnapshots(featureId: string): Promise<FeatureSnapshot[]>;
  getSnapshot(featureId: string, snapshotId: string): Promise<FeatureSnapshot | null>;

  saveEvents(events: FeatureHistoryEvent[]): Promise<void>;
  getEvents(featureId: string): Promise<FeatureHistoryEvent[]>;
  getEvent(featureId: string, eventId: string): Promise<FeatureHistoryEvent | null>;

  saveConflicts(conflicts: FeatureHistoryConflict[]): Promise<void>;
  getConflicts(featureId: string): Promise<FeatureHistoryConflict[]>;
}
