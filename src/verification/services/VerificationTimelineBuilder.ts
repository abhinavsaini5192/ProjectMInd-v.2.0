import type { VerificationRecord } from '../models/VerificationRecord.js';
import type {
  VerificationTimeline,
  VerificationTimelineEntry,
} from '../models/VerificationTimeline.js';

export class VerificationTimelineBuilder {
  public buildTimeline(taskId: string, records: readonly VerificationRecord[]): VerificationTimeline {
    const taskRecords = records.filter((r) => r.taskId === taskId);

    // Sort chronologically ascending by completedAt or receivedAt
    const sorted = [...taskRecords].sort((a, b) => {
      const timeA = new Date(a.completedAt ?? a.receivedAt).getTime();
      const timeB = new Date(b.completedAt ?? b.receivedAt).getTime();
      return timeA - timeB;
    });


    const entries: VerificationTimelineEntry[] = sorted.map((r, index) => {
      const causality: 'EXPLICIT' | 'SEQUENTIAL' = r.correlationId ? 'EXPLICIT' : 'SEQUENTIAL';

      return {
        entryId: `tl_entry_${r.verificationId}_${index}`,
        verificationId: r.verificationId,
        timestamp: r.completedAt ?? r.receivedAt,
        verificationType: r.verificationType,
        status: r.status,
        source: r.source,
        provenance: r.provenance,
        summary: r.summary,
        repositoryState: r.repositoryState,
        causality,
        affectedResources: r.scope.targetFiles,
        correlationId: r.correlationId,
        operationId: r.operationId,
      };
    });

    return {
      taskId,
      entries,
      totalEntries: entries.length,
      generatedAt: new Date().toISOString(),
    };
  }
}
