import { describe, it, expect, vi } from 'vitest';
import { TransactionManager } from '../../src/storage/consistency/TransactionManager';
import { StorageCoreError } from '../../src/storage/types/StorageErrors';

describe('Phase 8.4 - Transaction Management', () => {
  it('should begin and commit a managed transaction successfully', async () => {
    const txManager = new TransactionManager();
    const tx = await txManager.beginTransaction({ name: 'tx_test_commit' });

    expect(tx.status).toBe('ACTIVE');
    expect(tx.name).toBe('tx_test_commit');
    expect(tx.transactionId).toBeDefined();

    await tx.commit();
    expect(tx.status).toBe('COMMITTED');
  });

  it('should begin and rollback a managed transaction with a reason', async () => {
    const txManager = new TransactionManager();
    const tx = await txManager.beginTransaction({ name: 'tx_test_rollback' });

    expect(tx.status).toBe('ACTIVE');
    await tx.rollback('manual abort');
    expect(tx.status).toBe('ROLLED_BACK');
  });

  it('should disallow committing a transaction that is already committed or rolled back', async () => {
    const txManager = new TransactionManager();
    const tx = await txManager.beginTransaction();

    await tx.commit();
    await expect(tx.commit()).rejects.toThrow(StorageCoreError);

    const tx2 = await txManager.beginTransaction();
    await tx2.rollback('canceled');
    await expect(tx2.commit()).rejects.toThrow(StorageCoreError);
  });

  it('should support savepoints and rollbackToSavepoint', async () => {
    const txManager = new TransactionManager();
    const tx = await txManager.beginTransaction();

    await tx.createSavepoint('sp_checkpoint_1');
    await tx.rollbackToSavepoint('sp_checkpoint_1');
    expect(tx.status).toBe('ACTIVE');

    // Rolling back to non-existent savepoint should throw
    await expect(tx.rollbackToSavepoint('non_existent')).rejects.toThrow(StorageCoreError);

    await tx.commit();
  });

  it('should run operation in transaction and commit automatically on success', async () => {
    const txManager = new TransactionManager();
    let executedInTx = false;

    const result = await txManager.runInTransaction(async (tx) => {
      expect(tx.status).toBe('ACTIVE');
      executedInTx = true;
      return 42;
    }, { name: 'auto_commit_tx' });

    expect(result).toBe(42);
    expect(executedInTx).toBe(true);
    expect(txManager.getActiveTransactions()).toHaveLength(0);
  });

  it('should automatically rollback when operation in runInTransaction fails', async () => {
    const txManager = new TransactionManager();

    await expect(
      txManager.runInTransaction(async (tx) => {
        expect(tx.status).toBe('ACTIVE');
        throw new Error('Database disk I/O error');
      }, { name: 'failing_tx' })
    ).rejects.toThrow('Database disk I/O error');

    expect(txManager.getActiveTransactions()).toHaveLength(0);
  });

  it('should handle transaction timeout gracefully', async () => {
    vi.useFakeTimers();
    const txManager = new TransactionManager();
    const tx = await txManager.beginTransaction({ timeoutMs: 200 });

    expect(tx.status).toBe('ACTIVE');
    vi.advanceTimersByTime(250);

    expect(tx.status).toBe('TIMED_OUT');
    await expect(tx.commit()).rejects.toThrow(StorageCoreError);
    vi.useRealTimers();
  });
});
