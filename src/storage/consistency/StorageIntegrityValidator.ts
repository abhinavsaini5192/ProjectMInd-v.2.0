import type {
  IStorageIntegrityValidator,
  IntegrityCheckRule,
  IntegrityIssue,
  IntegrityReport,
} from './StorageIntegrityTypes.js';
import type { ILogger } from '../../workspace/interfaces/ILogger.js';

export class StorageIntegrityValidator implements IStorageIntegrityValidator {
  private readonly rules: IntegrityCheckRule[] = [];

  constructor(private readonly logger?: ILogger | undefined) {}

  public registerRule(rule: IntegrityCheckRule): void {
    this.rules.push(rule);
  }

  public checkEntityScope(
    entityType: string,
    entityId: string,
    workspaceId: string,
    repositoryId?: string
  ): IntegrityIssue[] {
    const issues: IntegrityIssue[] = [];

    if (!workspaceId || workspaceId.trim().length === 0) {
      issues.push({
        issueId: `iss_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        entityType,
        entityId,
        issueType: 'SCOPE_VIOLATION',
        severity: 'CRITICAL',
        description: `Entity ${entityType} '${entityId}' has missing or empty workspaceId`,
        detectedAt: Date.now(),
        repairable: false,
      });
    }

    if (repositoryId !== undefined && repositoryId.trim().length === 0) {
      issues.push({
        issueId: `iss_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        entityType,
        entityId,
        issueType: 'SCOPE_VIOLATION',
        severity: 'HIGH',
        description: `Entity ${entityType} '${entityId}' specifies empty repositoryId`,
        detectedAt: Date.now(),
        repairable: false,
        workspaceId,
      });
    }

    return issues;
  }

  public checkForeignReference(
    childType: string,
    childId: string,
    parentType: string,
    parentId: string,
    parentExists: boolean
  ): IntegrityIssue | null {
    if (!parentExists) {
      return {
        issueId: `iss_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        entityType: childType,
        entityId: childId,
        issueType: 'FOREIGN_KEY_VIOLATION',
        severity: 'HIGH',
        description: `Orphan child: ${childType} '${childId}' references non-existent ${parentType} '${parentId}'`,
        detectedAt: Date.now(),
        repairable: false,
        metadata: { parentType, parentId },
      };
    }
    return null;
  }

  public async runIntegrityChecks(): Promise<IntegrityReport> {
    const startTime = Date.now();
    const allIssues: IntegrityIssue[] = [];
    let totalChecked = 0;

    for (const rule of this.rules) {
      try {
        const issues = await rule.check();
        totalChecked++;
        allIssues.push(...issues);
      } catch (err: any) {
        allIssues.push({
          issueId: `iss_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          entityType: 'INTEGRITY_RULE',
          entityId: rule.name,
          issueType: 'INVALID_STATE_COMBINATION',
          severity: 'HIGH',
          description: `Integrity rule '${rule.name}' failed to execute: ${err.message}`,
          detectedAt: Date.now(),
          repairable: false,
        });
      }
    }

    const summary = {
      critical: allIssues.filter((i) => i.severity === 'CRITICAL').length,
      high: allIssues.filter((i) => i.severity === 'HIGH').length,
      medium: allIssues.filter((i) => i.severity === 'MEDIUM').length,
      low: allIssues.filter((i) => i.severity === 'LOW').length,
    };

    const isValid = summary.critical === 0 && summary.high === 0;
    const durationMs = Date.now() - startTime;

    this.logger?.info?.({
      component: 'StorageIntegrityValidator',
      operation: 'runIntegrityChecks',
      message: `Integrity check complete: ${isValid ? 'PASSED' : 'FAILED'} (${allIssues.length} issues, duration: ${durationMs}ms)`,
      details: { summary, durationMs },
    });

    return {
      isValid,
      checkedAt: startTime,
      durationMs,
      totalChecked,
      issues: allIssues,
      summary,
    };
  }
}
