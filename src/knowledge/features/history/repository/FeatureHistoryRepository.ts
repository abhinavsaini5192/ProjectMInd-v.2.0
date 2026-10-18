import type { IFeatureHistoryRepository } from '../interfaces/IFeatureHistoryRepository.js';
import type { FeatureHistory } from '../models/FeatureHistory.js';
import type { FeatureSnapshot } from '../models/FeatureSnapshot.js';
import type { FeatureHistoryEvent } from '../models/FeatureHistoryEvent.js';
import type { FeatureHistoryConflict } from '../models/FeatureHistoryConflict.js';

export class FeatureHistoryRepository implements IFeatureHistoryRepository {
  private histories = new Map<string, FeatureHistory>();
  private snapshots = new Map<string, FeatureSnapshot[]>();
  private events = new Map<string, FeatureHistoryEvent[]>();
  private conflicts = new Map<string, FeatureHistoryConflict[]>();

  public async saveHistory(history: FeatureHistory): Promise<void> {
    this.histories.set(history.featureId, history);
    if (history.snapshots && history.snapshots.length > 0) {
      this.snapshots.set(history.featureId, [...history.snapshots]);
    }
    if (history.timeline && history.timeline.events) {
      this.events.set(history.featureId, [...history.timeline.events]);
    }
  }

  public async getHistory(featureId: string): Promise<FeatureHistory | null> {
    return this.histories.get(featureId) || null;
  }

  public async getAllHistories(): Promise<FeatureHistory[]> {
    return Array.from(this.histories.values());
  }

  public async deleteHistory(featureId: string): Promise<boolean> {
    const existed = this.histories.delete(featureId);
    this.snapshots.delete(featureId);
    this.events.delete(featureId);
    this.conflicts.delete(featureId);
    return existed;
  }

  public async saveSnapshot(snapshot: FeatureSnapshot): Promise<void> {
    const list = this.snapshots.get(snapshot.featureId) || [];
    const existingIndex = list.findIndex((s) => s.snapshotId === snapshot.snapshotId);
    if (existingIndex >= 0) {
      list[existingIndex] = snapshot;
    } else {
      list.push(snapshot);
      list.sort((a, b) => a.timestamp - b.timestamp);
    }
    this.snapshots.set(snapshot.featureId, list);
  }

  public async getSnapshots(featureId: string): Promise<FeatureSnapshot[]> {
    const list = this.snapshots.get(featureId) || [];
    return [...list].sort((a, b) => a.timestamp - b.timestamp);
  }

  public async getSnapshot(featureId: string, snapshotId: string): Promise<FeatureSnapshot | null> {
    const list = this.snapshots.get(featureId) || [];
    return list.find((s) => s.snapshotId === snapshotId) || null;
  }

  public async saveEvents(events: FeatureHistoryEvent[]): Promise<void> {
    for (const event of events) {
      const list = this.events.get(event.featureId) || [];
      const existingIdx = list.findIndex((e) => e.eventId === event.eventId);
      if (existingIdx >= 0) {
        list[existingIdx] = event;
      } else {
        list.push(event);
      }
      list.sort((a, b) => a.timestamp - b.timestamp);
      this.events.set(event.featureId, list);
    }
  }

  public async getEvents(featureId: string): Promise<FeatureHistoryEvent[]> {
    const list = this.events.get(featureId) || [];
    return [...list].sort((a, b) => a.timestamp - b.timestamp);
  }

  public async getEvent(featureId: string, eventId: string): Promise<FeatureHistoryEvent | null> {
    const list = this.events.get(featureId) || [];
    return list.find((e) => e.eventId === eventId) || null;
  }

  public async saveConflicts(conflicts: FeatureHistoryConflict[]): Promise<void> {
    for (const conflict of conflicts) {
      const list = this.conflicts.get(conflict.featureId) || [];
      const existingIdx = list.findIndex((c) => c.conflictId === conflict.conflictId);
      if (existingIdx >= 0) {
        list[existingIdx] = conflict;
      } else {
        list.push(conflict);
      }
      this.conflicts.set(conflict.featureId, list);
    }
  }

  public async getConflicts(featureId: string): Promise<FeatureHistoryConflict[]> {
    return [...(this.conflicts.get(featureId) || [])];
  }

  public clear(): void {
    this.histories.clear();
    this.snapshots.clear();
    this.events.clear();
    this.conflicts.clear();
  }
}
