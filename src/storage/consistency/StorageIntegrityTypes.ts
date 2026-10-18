export type IntegrityIssueType =
  | 'FOREIGN_KEY_VIOLATION'
  | 'ORPHAN_RECORD'
  | 'VERSION_MISMATCH'
  | 'SCOPE_VIOLATION'
  | 'DUPLICATE_IDENTITY'
  | 'CORRUPTED_PAYLOAD'
  | 'MISSING_REQUIRED_FIELD'
  | 'INVALID_STATE_COMBINATION';

export type IntegritySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface IntegrityIssue {
  readonly issueId: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly issueType: IntegrityIssueType;
  readonly severity: IntegritySeverity;
  readonly description: string;
  readonly detectedAt: number;
  readonly repairable: boolean;
  readonly workspaceId?: string | undefined;
  readonly repositoryId?: string | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
}

export interface IntegrityReport {
  readonly isValid: boolean;
  readonly checkedAt: number;
  readonly durationMs: number;
  readonly totalChecked: number;
  readonly issues: readonly IntegrityIssue[];
  readonly summary: {
    readonly critical: number;
    readonly high: number;
    readonly medium: number;
    readonly low: number;
  };
}

export interface IntegrityCheckRule {
  readonly name: string;
  readonly description: string;
  readonly check: () => Promise<IntegrityIssue[]>;
}

export interface IStorageIntegrityValidator {
  registerRule(rule: IntegrityCheckRule): void;
  runIntegrityChecks(): Promise<IntegrityReport>;
  checkEntityScope(
    entityType: string,
    entityId: string,
    workspaceId: string,
    repositoryId?: string
  ): IntegrityIssue[];
  checkForeignReference(
    childType: string,
    childId: string,
    parentType: string,
    parentId: string,
    parentExists: boolean
  ): IntegrityIssue | null;
}

export const IStorageIntegrityValidatorToken = Symbol('IStorageIntegrityValidator');
