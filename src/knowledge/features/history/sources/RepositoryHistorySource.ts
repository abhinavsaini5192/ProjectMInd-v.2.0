import type {
  IFeatureHistorySource,
  FeatureHistorySourceContext,
} from '../interfaces/IFeatureHistorySource.js';
import type { FeatureHistoryEvent } from '../models/FeatureHistoryEvent.js';
import type { FeatureHistorySourceType } from '../models/FeatureHistorySource.js';
import type { FeatureChangeRecord } from '../models/FeatureChangeRecord.js';
import { createHistoryConfidence } from '../models/FeatureHistoryConfidence.js';

export class RepositoryHistorySource implements IFeatureHistorySource {
  public readonly sourceType: FeatureHistorySourceType = 'REPOSITORY';
  private records: FeatureChangeRecord[] = [];
  private recordedEvents: FeatureHistoryEvent[] = [];

  constructor(records: FeatureChangeRecord[] = [], recordedEvents: FeatureHistoryEvent[] = []) {
    this.records = [...records];
    this.recordedEvents = [...recordedEvents];
  }

  public addRecord(record: FeatureChangeRecord): void {
    this.records.push(record);
  }

  public recordEvent(event: FeatureHistoryEvent): void {
    this.recordedEvents.push(event);
  }

  public async fetchEvents(
    context: FeatureHistorySourceContext
  ): Promise<FeatureHistoryEvent[]> {
    const directEvents = this.recordedEvents.filter((e) => e.featureId === context.featureId);

    // Convert change records to events if any
    const recordEvents: FeatureHistoryEvent[] = this.records.map((r, index) => {
      const isFormatting = r.changeType === 'FORMATTING_ONLY';
      const isSemantic = r.isSemantic && !isFormatting;

      return {
        eventId: `repo_change_${r.changeId || index}`,
        featureId: context.featureId,
        eventType: isSemantic ? 'FEATURE_ARCHITECTURE_CHANGED' : 'TECHNICAL_CHANGE',
        evolutionType: isSemantic ? 'ARCHITECTURAL' : 'TECHNICAL',
        timestamp: r.timestamp || Date.now(),
        source: {
          system: 'REPOSITORY',
          provenance: 'OBSERVED',
          referenceId: r.commitHash || r.changeId,
          details: {
            filePath: r.filePath,
            changeType: r.changeType,
            isSemantic,
          },
        },
        sourceReference: `commit:${r.commitHash || 'head'}`,
        changedDimensions: isSemantic ? ['implementation', 'architecture'] : ['formatting'],
        evidence: [
          {
            type: isFormatting ? 'FORMATTING_COMMIT' : 'GIT_COMMIT',
            description: r.message || `Change on ${r.filePath} (${r.changeType})`,
            source: r.commitHash,
            confidence: isSemantic ? 0.9 : 0.4,
          },
        ],
        confidence: isSemantic
          ? createHistoryConfidence('HIGH', 0.85, ['Repository semantic modification'])
          : createHistoryConfidence('LOW', 0.3, ['Non-semantic technical change']),
        knowledgeVersion: context.knowledgeVersion || '1.0.0',
        metadata: {
          isFormatting,
          isSemantic,
          filePath: r.filePath,
        },
      };
    });

    return [...directEvents, ...recordEvents];
  }
}
