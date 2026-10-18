import { describe, it, expect, vi } from 'vitest';
import { BackupRestoreValidator } from '../../src/reliability/disaster/BackupRestoreValidator.js';
import { DisasterRecoveryManager } from '../../src/reliability/disaster/DisasterRecoveryManager.js';
import { RecoveryVerifier } from '../../src/reliability/verification/RecoveryVerifier.js';
import type { BackupMetadata } from '../../src/storage/recovery/BackupTypes.js';

describe('Reliability - Disaster Recovery & Backup Validation', () => {
  const validBackup: BackupMetadata = {
    backupId: 'bak-20260928-001',
    createdAt: Date.now() - 5000,
    storageVersion: 2,
    applicationVersion: '1.0.0',
    scope: { isFull: true },
    status: 'COMPLETED',
    sizeBytes: 1048576,
    integrityHash: 'sha256-abcdef1234567890',
  };

  describe('BackupRestoreValidator', () => {
    it('validates a well-formed completed backup metadata', () => {
      const res = BackupRestoreValidator.validateBackup(validBackup);
      expect(res.isValid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it('rejects backup with missing fields or corrupt status', () => {
      const invalidBackup: BackupMetadata = {
        ...validBackup,
        status: 'FAILED',
        integrityHash: '',
      };

      const res = BackupRestoreValidator.validateBackup(invalidBackup);
      expect(res.isValid).toBe(false);
      expect(res.errors.some((e) => e.includes('expected \'COMPLETED\''))).toBe(true);
      expect(res.errors.some((e) => e.includes('Missing integrity hash'))).toBe(true);
    });

    it('validates restore operation and rejects missing authorization identity', () => {
      const assessment = BackupRestoreValidator.validateRestore(
        {
          backupId: validBackup.backupId,
          type: 'FULL',
          authorizedBy: '', // Missing authorizedBy
        },
        validBackup,
        2
      );

      expect(assessment.canRestore).toBe(false);
      expect(assessment.errors.some((e) => e.includes('missing authorizedBy identity'))).toBe(true);
    });

    it('rejects restore if backup schema version is newer than current system storage version', () => {
      const futureBackup: BackupMetadata = {
        ...validBackup,
        storageVersion: 5,
      };

      const assessment = BackupRestoreValidator.validateRestore(
        {
          backupId: futureBackup.backupId,
          type: 'FULL',
          authorizedBy: 'sec-admin',
        },
        futureBackup,
        2 // Current version is only 2
      );

      expect(assessment.canRestore).toBe(false);
      expect(assessment.errors.some((e) => e.includes('is newer than current storage version'))).toBe(true);
    });
  });

  describe('RecoveryVerifier', () => {
    it('verifies all 7 recovery components and reports success', async () => {
      const verifier = new RecoveryVerifier({
        checkStorage: () => true,
        checkSchema: () => true,
        checkIntegrity: () => true,
        checkSecurity: () => true,
        checkJobs: () => true,
        checkEventBus: () => true,
        checkKnowledge: () => true,
      });

      const res = await verifier.verify();
      expect(res.isVerified).toBe(true);
      expect(res.componentsChecked).toHaveLength(7);
      expect(res.errors).toHaveLength(0);
    });

    it('reports verification failure when any critical component check fails', async () => {
      const verifier = new RecoveryVerifier({
        checkStorage: () => true,
        checkSecurity: () => false, // Security boundary check failed!
      });

      const res = await verifier.verify();
      expect(res.isVerified).toBe(false);
      expect(res.errors.some((e) => e.includes('security_boundaries'))).toBe(true);
    });
  });

  describe('DisasterRecoveryManager', () => {
    it('coordinates full restore workflow with validation, locking, execution, and verification', async () => {
      const mockBackupManager = {
        inspectBackup: vi.fn().mockResolvedValue(validBackup),
      } as any;

      const mockRestoreManager = {
        executeRestore: vi.fn().mockResolvedValue({
          success: true,
          restoreId: 'rest-001',
          backupId: validBackup.backupId,
          targetWorkspaceId: 'ws-123',
          restoredEntitiesCount: 150,
          startedAt: Date.now() - 1000,
          completedAt: Date.now(),
          durationMs: 1000,
        }),
      } as any;

      const mockLockManager = {
        acquire: vi.fn().mockResolvedValue({
          success: true,
          lock: { lockId: 'lock-dr-1', resourceKey: 'dr:restore:ws:ws-123', ownerId: 'dr-op' },
        }),
        release: vi.fn().mockResolvedValue(true),
      } as any;

      const mockVerifier = {
        verify: vi.fn().mockResolvedValue({
          isVerified: true,
          componentsChecked: ['storage', 'security'],
          errors: [],
          warnings: [],
          checkedAt: Date.now(),
        }),
      } as any;

      const drManager = new DisasterRecoveryManager(
        mockBackupManager,
        mockRestoreManager,
        mockLockManager,
        mockVerifier
      );

      const op = await drManager.executeDisasterRestore({
        backupId: validBackup.backupId,
        authorizedBy: 'platform-admin',
        targetWorkspaceId: 'ws-123',
        currentStorageVersion: 2,
      });

      expect(op.status).toBe('RECOVERED');
      expect(op.initiatedBy).toBe('platform-admin');
      expect(op.scope).toBe('ws:ws-123');
      expect(op.verification?.isVerified).toBe(true);
      expect(drManager.getCurrentState()).toBe('RECOVERED');

      // Verify lock lifecycle
      expect(mockLockManager.acquire).toHaveBeenCalledWith('dr:restore:ws:ws-123', expect.any(String), expect.any(Object));
      expect(mockLockManager.release).toHaveBeenCalledWith('lock-dr-1', expect.any(String));

      // Check operation is retrievable
      const retrieved = drManager.getOperation(op.operationId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.operationId).toBe(op.operationId);
    });

    it('blocks restore when exclusive coordination lock cannot be acquired', async () => {
      const mockBackupManager = {
        inspectBackup: vi.fn().mockResolvedValue(validBackup),
      } as any;

      const mockLockManager = {
        acquire: vi.fn().mockResolvedValue({
          success: false, // Lock contention
        }),
        release: vi.fn(),
      } as any;

      const drManager = new DisasterRecoveryManager(
        mockBackupManager,
        undefined,
        mockLockManager,
        undefined
      );

      const op = await drManager.executeDisasterRestore({
        backupId: validBackup.backupId,
        authorizedBy: 'platform-admin',
        currentStorageVersion: 2,
      });

      expect(op.status).toBe('BLOCKED');
      expect(drManager.getCurrentState()).toBe('BLOCKED');
      expect(op.errors[0]).toContain('Could not acquire exclusive restore lock');
      expect(mockLockManager.release).not.toHaveBeenCalled();
    });
  });
});
