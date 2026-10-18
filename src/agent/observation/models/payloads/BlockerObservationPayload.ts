export type BlockerObservationCategory =
  | 'DEPENDENCY'
  | 'MISSING_INFORMATION'
  | 'EXTERNAL_SERVICE'
  | 'VERIFICATION'
  | 'CONFLICT'
  | 'PERMISSION'
  | 'SECURITY'
  | 'ENVIRONMENT'
  | 'UNKNOWN';

export interface BlockerObservationPayload {
  readonly blockerId: string;
  readonly category: BlockerObservationCategory;
  readonly description: string;
  readonly severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly status: 'ACTIVE' | 'RESOLVED' | 'WAIVED';
  readonly resolutionHint?: string | undefined;
}
