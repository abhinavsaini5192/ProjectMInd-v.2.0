export type TransactionStatus =
  | 'ACTIVE'
  | 'COMMITTED'
  | 'ROLLED_BACK'
  | 'FAILED'
  | 'TIMED_OUT';

export type TransactionIsolationLevel =
  | 'READ_UNCOMMITTED'
  | 'READ_COMMITTED'
  | 'REPEATABLE_READ'
  | 'SERIALIZABLE';

export interface TransactionOptions {
  readonly name?: string | undefined;
  readonly isolationLevel?: TransactionIsolationLevel | undefined;
  readonly readOnly?: boolean | undefined;
  readonly timeoutMs?: number | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
}

export interface ITransaction {
  readonly transactionId: string;
  readonly name: string;
  readonly status: TransactionStatus;
  readonly startTime: number;
  readonly isolationLevel: TransactionIsolationLevel;
  readonly readOnly: boolean;

  commit(): Promise<void>;
  rollback(reason?: string): Promise<void>;
  createSavepoint(name: string): Promise<void>;
  rollbackToSavepoint(name: string): Promise<void>;
  releaseSavepoint(name: string): Promise<void>;
}

export interface ITransactionManager {
  beginTransaction(options?: TransactionOptions): Promise<ITransaction>;
  runInTransaction<T>(
    operation: (tx: ITransaction) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T>;
  getActiveTransactions(): readonly ITransaction[];
}

export const ITransactionManagerToken = Symbol('ITransactionManager');
