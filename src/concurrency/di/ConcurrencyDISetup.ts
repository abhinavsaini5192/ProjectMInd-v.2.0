import type { DIContainer } from '../../workspace/di/DIContainer.js';
import { ConcurrencyTokens } from './ConcurrencyTokens.js';
import { ResourceLockManager } from '../locking/ResourceLockManager.js';
import { CoordinationService } from '../coordination/CoordinationService.js';
import { WorkloadLimiter } from '../limits/WorkloadLimiter.js';
import { RequestCoalescer } from '../coalescing/RequestCoalescer.js';
import { ConflictResolver } from '../consistency/ConflictResolver.js';
import { StaleLockRecoveryManager } from '../recovery/StaleLockRecoveryManager.js';
import { ConcurrencyTelemetry } from '../observability/ConcurrencyTelemetry.js';

export interface ConcurrencyServices {
  readonly lockManager: ResourceLockManager;
  readonly coordination: CoordinationService;
  readonly workloadLimiter: WorkloadLimiter;
  readonly requestCoalescer: RequestCoalescer;
  readonly conflictResolver: ConflictResolver;
  readonly recoveryManager: StaleLockRecoveryManager;
  readonly telemetry: ConcurrencyTelemetry;
}

export class ConcurrencyDISetup {
  public static registerConcurrency(
    container: DIContainer,
    overrides: Partial<ConcurrencyServices> = {}
  ): ConcurrencyServices {
    const telemetry = overrides.telemetry ?? new ConcurrencyTelemetry();
    const lockManager = overrides.lockManager ?? new ResourceLockManager();
    const coordination = overrides.coordination ?? new CoordinationService();
    const workloadLimiter = overrides.workloadLimiter ?? new WorkloadLimiter();
    const requestCoalescer = overrides.requestCoalescer ?? new RequestCoalescer();
    const conflictResolver = overrides.conflictResolver ?? new ConflictResolver();
    const recoveryManager =
      overrides.recoveryManager ?? new StaleLockRecoveryManager(lockManager, coordination, telemetry);

    // Register with container
    container.registerInstance(ConcurrencyTokens.ConcurrencyTelemetry, telemetry);
    container.registerInstance(ConcurrencyTokens.ResourceLockManager, lockManager);
    container.registerInstance(ConcurrencyTokens.CoordinationService, coordination);
    container.registerInstance(ConcurrencyTokens.WorkloadLimiter, workloadLimiter);
    container.registerInstance(ConcurrencyTokens.RequestCoalescer, requestCoalescer);
    container.registerInstance(ConcurrencyTokens.ConflictResolver, conflictResolver);
    container.registerInstance(ConcurrencyTokens.StaleLockRecoveryManager, recoveryManager);

    return {
      telemetry,
      lockManager,
      coordination,
      workloadLimiter,
      requestCoalescer,
      conflictResolver,
      recoveryManager,
    };
  }
}
