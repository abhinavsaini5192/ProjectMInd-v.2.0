import type { ExecutionObservation } from '../models/ExecutionObservation.js';
import type { RawObservationInput } from './IObservationNormalizer.js';
import type { ScopeValidationParams } from './IObservationValidator.js';
import type { ObservationConflict } from '../models/ObservationConflict.js';

export interface ProcessExecutionReportParams {
  readonly taskId: string;
  readonly contextSessionId?: string | undefined;
  readonly status: string;
  readonly summary: string;
  readonly modifiedFiles?: readonly string[] | undefined;
  readonly addedFiles?: readonly string[] | undefined;
  readonly deletedFiles?: readonly string[] | undefined;
  readonly commandText?: string | undefined;
  readonly operationId?: string | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
}

export interface ProcessVerificationReportParams {
  readonly taskId: string;
  readonly passed: boolean;
  readonly summary: string;
  readonly testResults?: readonly Record<string, unknown>[] | undefined;
  readonly diagnostics?: readonly string[] | undefined;
  readonly buildPassed?: boolean | undefined;
  readonly lintPassed?: boolean | undefined;
  readonly typeCheckPassed?: boolean | undefined;
  readonly operationId?: string | undefined;
  readonly source?: 'AGENT' | 'VERIFICATION' | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
}

export interface ObservationProcessingResult {
  readonly observation: ExecutionObservation;
  readonly processed: boolean;
  readonly isDuplicate: boolean;
  readonly conflicts: readonly ObservationConflict[];
  readonly invalidationDecision?: string | undefined;
}

export interface BatchObservationProcessingResult {
  readonly observations: readonly ExecutionObservation[];
  readonly conflicts: readonly ObservationConflict[];
  readonly invalidationDecision?: string | undefined;

  // Single observation convenience accessors:
  readonly observation?: ExecutionObservation | undefined;
  readonly conflictDetected?: boolean | undefined;
  readonly conflict?: ObservationConflict | undefined;
}

export interface IObservationProcessor {
  processRawObservation(
    input: RawObservationInput,
    scope?: ScopeValidationParams
  ): Promise<ObservationProcessingResult>;

  process(
    input: RawObservationInput,
    scope?: ScopeValidationParams
  ): Promise<ObservationProcessingResult>;

  processExecutionReport(
    params: ProcessExecutionReportParams,
    scope?: ScopeValidationParams | string
  ): Promise<BatchObservationProcessingResult>;

  processVerificationReport(
    params: ProcessVerificationReportParams,
    scope?: ScopeValidationParams | string
  ): Promise<BatchObservationProcessingResult>;
}
