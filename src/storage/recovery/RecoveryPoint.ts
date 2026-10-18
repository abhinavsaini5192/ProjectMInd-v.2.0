import type { BackupScope } from './BackupTypes.js';
import type { ILogger } from '../../workspace/interfaces/ILogger.js';

export interface RecoveryPoint {
  readonly recoveryPointId: string;
  readonly createdAt: number;
  readonly storageVersion: number;
  readonly applicationVersion: string;
  readonly source: string;
  readonly integrityStatus: 'VALID' | 'SUSPECT' | 'INVALID';
  readonly scope: BackupScope;
  readonly metadata: Record<string, unknown>;
}

export interface IRecoveryManager {
  createRecoveryPoint(
    source: string,
    scope?: BackupScope,
    metadata?: Record<string, unknown>
  ): Promise<RecoveryPoint>;
  getRecoveryPoint(recoveryPointId: string): Promise<RecoveryPoint | undefined>;
  listRecoveryPoints(workspaceId?: string): Promise<readonly RecoveryPoint[]>;
}

export class StorageRecoveryManager implements IRecoveryManager {
  private readonly recoveryPoints = new Map<string, RecoveryPoint>();

  constructor(
    private readonly applicationVersion: string = '1.0.0',
    private readonly getStorageVersion: () => Promise<number> | number = () => 1,
    private readonly logger?: ILogger | undefined
  ) {}

  public async createRecoveryPoint(
    source: string,
    scope: BackupScope = { isFull: true },
    metadata: Record<string, unknown> = {}
  ): Promise<RecoveryPoint> {
    const recoveryPointId = `rp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const storageVersion = await this.getStorageVersion();

    const rp: RecoveryPoint = {
      recoveryPointId,
      createdAt: Date.now(),
      storageVersion,
      applicationVersion: this.applicationVersion,
      source,
      integrityStatus: 'VALID',
      scope,
      metadata,
    };

    this.recoveryPoints.set(recoveryPointId, rp);

    this.logger?.info?.({
      component: 'StorageRecoveryManager',
      operation: 'createRecoveryPoint',
      message: `Created recovery point '${recoveryPointId}' from source '${source}'`,
    });

    return rp;
  }

  public async getRecoveryPoint(recoveryPointId: string): Promise<RecoveryPoint | undefined> {
    return this.recoveryPoints.get(recoveryPointId);
  }

  public async listRecoveryPoints(workspaceId?: string): Promise<readonly RecoveryPoint[]> {
    let result = Array.from(this.recoveryPoints.values());
    if (workspaceId) {
      result = result.filter(
        (rp) => rp.scope.workspaceId === workspaceId || rp.scope.isFull
      );
    }
    return result.sort((a, b) => b.createdAt - a.createdAt);
  }
}

export const IRecoveryManagerToken = Symbol('IRecoveryManager');
