import { describe, it, expect } from 'vitest';
import { StorageBackupManager } from '../../src/storage/recovery/StorageBackupManager';
import { StorageRestoreManager } from '../../src/storage/recovery/StorageRestoreManager';
import { StorageRecoveryManager } from '../../src/storage/recovery/RecoveryPoint';
import { StorageCoreError } from '../../src/storage/types/StorageErrors';

describe('Phase 8.4 - Backup, Restore & Recovery Management', () => {
  it('should create a backup with valid metadata and sha256 integrity hash', async () => {
    const backupManager = new StorageBackupManager({
      getStorageVersion: () => 1,
      applicationVersion: '1.0.0',
    });

    const backup = await backupManager.createBackup({
      scope: { isFull: true },
      payload: JSON.stringify({ table1: [{ id: 1, name: 'Alice' }] }),
      description: 'Initial full backup',
    });

    expect(backup.backupId).toBeDefined();
    expect(backup.status).toBe('COMPLETED');
    expect(backup.sizeBytes).toBeGreaterThan(0);
    expect(backup.integrityHash).toHaveLength(64); // SHA-256 hex length
    expect(backup.scope.isFull).toBe(true);
  });

  it('should validate backup integrity successfully when untampered', async () => {
    const backupManager = new StorageBackupManager({
      getStorageVersion: () => 1,
      applicationVersion: '1.0.0',
    });

    const backup = await backupManager.createBackup({
      scope: { isFull: true },
      payload: 'sample_payload_data',
    });

    const validation = await backupManager.validateBackup(backup.backupId);
    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('should detect corrupted or tampered backups during validation', async () => {
    const backupManager = new StorageBackupManager({
      getStorageVersion: () => 1,
      applicationVersion: '1.0.0',
    });

    const backup = await backupManager.createBackup({
      scope: { isFull: true },
      payload: 'original_data',
    });

    // Tamper with data snapshot directly
    // @ts-ignore
    backupManager.backups.get(backup.backupId).dataSnapshot = 'maliciously_altered_data';

    const validation = await backupManager.validateBackup(backup.backupId);
    expect(validation.isValid).toBe(false);
    expect(validation.errors[0]).toContain('Integrity hash mismatch');
  });

  it('should require explicit operational authorization for restore', async () => {
    const backupManager = new StorageBackupManager({
      getStorageVersion: () => 1,
      applicationVersion: '1.0.0',
    });

    const restoreManager = new StorageRestoreManager({
      backupManager,
      getCurrentStorageVersion: () => 1,
    });

    const backup = await backupManager.createBackup({ scope: { isFull: true }, payload: 'data' });

    // Missing authorizedBy should throw StorageCoreError
    await expect(
      restoreManager.executeRestore({
        backupId: backup.backupId,
        type: 'FULL',
        authorizedBy: '',
      })
    ).rejects.toThrow(StorageCoreError);
  });

  it('should reject restoring incompatible backup schema versions blindly', async () => {
    const backupManager = new StorageBackupManager({
      getStorageVersion: () => 2, // Backup was made at schema v2
      applicationVersion: '1.0.0',
    });

    const restoreManager = new StorageRestoreManager({
      backupManager,
      getCurrentStorageVersion: () => 1, // Target is schema v1
    });

    const backup = await backupManager.createBackup({ scope: { isFull: true }, payload: 'data' });

    await expect(
      restoreManager.executeRestore({
        backupId: backup.backupId,
        type: 'FULL',
        authorizedBy: 'ops-lead',
      })
    ).rejects.toThrow(StorageCoreError);
  });

  it('should execute authorized restore and invoke applySnapshotData', async () => {
    let restoredPayload = '';
    const backupManager = new StorageBackupManager({
      getStorageVersion: () => 1,
      applicationVersion: '1.0.0',
    });

    const restoreManager = new StorageRestoreManager({
      backupManager,
      getCurrentStorageVersion: () => 1,
      applySnapshotData: async (snapshot) => {
        restoredPayload = snapshot;
        return 10;
      },
    });

    const backup = await backupManager.createBackup({ scope: { isFull: true }, payload: 'important_data' });

    const result = await restoreManager.executeRestore({
      backupId: backup.backupId,
      type: 'FULL',
      authorizedBy: 'security-admin',
    });

    expect(result.success).toBe(true);
    expect(result.affectedEntitiesCount).toBe(10);
    expect(restoredPayload).toBe('important_data');
  });

  it('should create and list recovery points', async () => {
    const recovery = new StorageRecoveryManager('1.0.0');

    const rp1 = await recovery.createRecoveryPoint(
      'MANUAL',
      { isFull: false, workspaceId: 'ws-prod' },
      { reason: 'pre-deployment' }
    );

    expect(rp1.recoveryPointId).toBeDefined();
    expect(rp1.source).toBe('MANUAL');
    expect(rp1.integrityStatus).toBe('VALID');

    const list = await recovery.listRecoveryPoints('ws-prod');
    expect(list).toHaveLength(1);
    expect(list[0].recoveryPointId).toBe(rp1.recoveryPointId);
  });
});
