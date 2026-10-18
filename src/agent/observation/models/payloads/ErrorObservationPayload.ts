export type ErrorObservationCategory =
  | 'BUILD'
  | 'TEST'
  | 'RUNTIME'
  | 'TYPE'
  | 'LINT'
  | 'DEPENDENCY'
  | 'CONFIGURATION'
  | 'INTEGRATION'
  | 'UNKNOWN';

export interface ErrorObservationPayload {
  readonly errorId: string;
  readonly category: ErrorObservationCategory;
  readonly message: string;
  readonly resource?: string | undefined;
  readonly severity: 'INFO' | 'WARNING' | 'ERROR' | 'FATAL';
  readonly code?: string | undefined;
  readonly location?: { readonly file: string; readonly line?: number; readonly column?: number } | undefined;
}
