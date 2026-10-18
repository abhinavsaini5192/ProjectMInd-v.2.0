export type ChangeRecordType =
  | 'ADDED'
  | 'MODIFIED'
  | 'DELETED'
  | 'FORMATTING_ONLY'
  | 'RENAME';

export interface FeatureChangeRecord {
  changeId: string;
  filePath: string;
  changeType: ChangeRecordType;
  isSemantic: boolean;
  commitHash?: string | undefined;
  author?: string | undefined;
  timestamp: number;
  message?: string | undefined;
  diffSummary?: {
    linesAdded: number;
    linesDeleted: number;
  } | undefined;
  metadata?: Record<string, any> | undefined;
}
