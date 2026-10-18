import type {
  ITransaction,
  ITransactionManager,
  TransactionIsolationLevel,
  TransactionOptions,
  TransactionStatus,
} from './TransactionTypes.js';
import { StorageCoreError } from '../types/StorageErrors.js';
import type { ILogger } from '../../workspace/interfaces/ILogger.js';

export class ManagedTransaction implements ITransaction {
  public readonly transactionId: string;
  public readonly name: string;
  public readonly startTime: number;
  public readonly isolationLevel: TransactionIsolationLevel;
  public readonly readOnly: boolean;

  private _status: TransactionStatus = 'ACTIVE';
  private readonly savepoints = new Set<string>();
  private timeoutHandle?: NodeJS.Timeout | undefined;

  constructor(
    options: TransactionOptions = {},
    private readonly onCommit: (tx: ManagedTransaction) => Promise<void>,
    private readonly onRollback: (tx: ManagedTransaction, reason?: string) => Promise<void>,
    private readonly logger?: ILogger | undefined
  ) {
    this.transactionId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.name = options.name ?? `tx_${this.transactionId}`;
    this.startTime = Date.now();
    this.isolationLevel = options.isolationLevel ?? 'READ_COMMITTED';
    this.readOnly = options.readOnly ?? false;

    if (options.timeoutMs && options.timeoutMs > 0) {
      this.timeoutHandle = setTimeout(() => {
        if (this._status === 'ACTIVE') {
          this._status = 'TIMED_OUT';
          this.logger?.warn?.({
            component: 'ManagedTransaction',
            operation: 'timeout',
            message: `Transaction ${this.name} (${this.transactionId}) timed out after ${options.timeoutMs}ms`,
          });
          this.onRollback(this, 'Transaction timeout exceeded').catch(() => {});
        }
      }, options.timeoutMs);
    }
  }

  public get status(): TransactionStatus {
    return this._status;
  }

  public async commit(): Promise<void> {
    if (this._status !== 'ACTIVE') {
      throw new StorageCoreError(
        `Cannot commit transaction ${this.name}: current status is '${this._status}'`
      );
    }

    this.clearTimer();
    try {
      await this.onCommit(this);
      this._status = 'COMMITTED';
    } catch (err: any) {
      this._status = 'FAILED';
      throw new StorageCoreError(`Transaction commit failed: ${err.message}`, err);
    }
  }

  public async rollback(reason?: string): Promise<void> {
    if (this._status === 'COMMITTED') {
      throw new StorageCoreError(
        `Cannot rollback transaction ${this.name}: already committed`
      );
    }
    if (this._status === 'ROLLED_BACK') {
      return; // Already rolled back, idempotent
    }

    this.clearTimer();
    try {
      await this.onRollback(this, reason);
      this._status = 'ROLLED_BACK';
    } catch (err: any) {
      this._status = 'FAILED';
      throw new StorageCoreError(`Transaction rollback failed: ${err.message}`, err);
    }
  }

  public async createSavepoint(name: string): Promise<void> {
    this.assertActive('createSavepoint');
    if (this.savepoints.has(name)) {
      throw new StorageCoreError(`Savepoint '${name}' already exists in transaction ${this.name}`);
    }
    this.savepoints.add(name);
  }

  public async rollbackToSavepoint(name: string): Promise<void> {
    this.assertActive('rollbackToSavepoint');
    if (!this.savepoints.has(name)) {
      throw new StorageCoreError(`Savepoint '${name}' does not exist in transaction ${this.name}`);
    }
  }

  public async releaseSavepoint(name: string): Promise<void> {
    this.assertActive('releaseSavepoint');
    if (!this.savepoints.has(name)) {
      throw new StorageCoreError(`Savepoint '${name}' does not exist to release`);
    }
    this.savepoints.delete(name);
  }

  private assertActive(op: string): void {
    if (this._status !== 'ACTIVE') {
      throw new StorageCoreError(
        `Cannot perform '${op}' on transaction ${this.name}: status is '${this._status}'`
      );
    }
  }

  private clearTimer(): void {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = undefined;
    }
  }
}

export class TransactionManager implements ITransactionManager {
  private readonly activeTransactions = new Map<string, ManagedTransaction>();

  constructor(private readonly logger?: ILogger | undefined) {}

  public async beginTransaction(options: TransactionOptions = {}): Promise<ITransaction> {
    const tx = new ManagedTransaction(
      options,
      async (t) => {
        this.activeTransactions.delete(t.transactionId);
        this.logger?.debug?.({
          component: 'TransactionManager',
          operation: 'commit',
          message: `Committed transaction ${t.name} (${t.transactionId})`,
        });
      },
      async (t, reason) => {
        this.activeTransactions.delete(t.transactionId);
        this.logger?.debug?.({
          component: 'TransactionManager',
          operation: 'rollback',
          message: `Rolled back transaction ${t.name} (${t.transactionId}): ${reason ?? 'No reason provided'}`,
        });
      },
      this.logger
    );

    this.activeTransactions.set(tx.transactionId, tx);
    return tx;
  }

  public async runInTransaction<T>(
    operation: (tx: ITransaction) => Promise<T>,
    options: TransactionOptions = {}
  ): Promise<T> {
    const tx = await this.beginTransaction(options);
    try {
      const result = await operation(tx);
      if (tx.status === 'ACTIVE') {
        await tx.commit();
      }
      return result;
    } catch (error: any) {
      if (tx.status === 'ACTIVE') {
        await tx.rollback(error.message);
      }
      throw error;
    }
  }

  public getActiveTransactions(): readonly ITransaction[] {
    return Array.from(this.activeTransactions.values());
  }
}
