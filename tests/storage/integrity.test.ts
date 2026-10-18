import { describe, it, expect } from 'vitest';
import { StorageIntegrityValidator } from '../../src/storage/consistency/StorageIntegrityValidator';

describe('Phase 8.4 - Storage Integrity Validation', () => {
  it('should flag missing or empty workspaceId as a CRITICAL scope violation', () => {
    const validator = new StorageIntegrityValidator();

    const issues = validator.checkEntityScope('Feature', 'feat-1', '');
    expect(issues).toHaveLength(1);
    expect(issues[0].issueType).toBe('SCOPE_VIOLATION');
    expect(issues[0].severity).toBe('CRITICAL');
    expect(issues[0].repairable).toBe(false);

    const validIssues = validator.checkEntityScope('Feature', 'feat-1', 'ws-default', 'repo-1');
    expect(validIssues).toHaveLength(0);
  });

  it('should flag orphan children referencing non-existent parents as FOREIGN_KEY_VIOLATION', () => {
    const validator = new StorageIntegrityValidator();

    const issue = validator.checkForeignReference(
      'KnowledgeUpdate',
      'upd-101',
      'Repository',
      'repo-999',
      false // parent does not exist
    );

    expect(issue).not.toBeNull();
    expect(issue?.issueType).toBe('FOREIGN_KEY_VIOLATION');
    expect(issue?.severity).toBe('HIGH');
    expect(issue?.entityId).toBe('upd-101');
    expect(issue?.metadata).toEqual({ parentType: 'Repository', parentId: 'repo-999' });

    // When parent exists
    const validIssue = validator.checkForeignReference(
      'KnowledgeUpdate',
      'upd-101',
      'Repository',
      'repo-1',
      true
    );
    expect(validIssue).toBeNull();
  });

  it('should execute registered integrity rules and generate a structured report', async () => {
    const validator = new StorageIntegrityValidator();

    validator.registerRule({
      name: 'check_orphaned_tasks',
      description: 'Checks for tasks without valid workspace',
      check: async () => [
        {
          issueId: 'iss_1',
          entityType: 'Task',
          entityId: 'task-ghost',
          issueType: 'ORPHAN_RECORD',
          severity: 'HIGH',
          description: 'Task has non-existent workspace',
          detectedAt: Date.now(),
          repairable: false,
        },
      ],
    });

    const report = await validator.runIntegrityChecks();
    expect(report.isValid).toBe(false);
    expect(report.totalChecked).toBe(1);
    expect(report.summary.high).toBe(1);
    expect(report.summary.critical).toBe(0);
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0].entityId).toBe('task-ghost');
  });

  it('should report isValid = true when all rules return clean reports', async () => {
    const validator = new StorageIntegrityValidator();

    validator.registerRule({
      name: 'clean_rule',
      description: 'All nodes clean',
      check: async () => [],
    });

    const report = await validator.runIntegrityChecks();
    expect(report.isValid).toBe(true);
    expect(report.issues).toHaveLength(0);
    expect(report.summary.critical).toBe(0);
    expect(report.summary.high).toBe(0);
  });
});
