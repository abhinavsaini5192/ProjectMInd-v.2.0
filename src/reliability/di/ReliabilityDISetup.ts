import type { DIContainer } from '../../workspace/di/DIContainer.js';
import { ReliabilityTokens } from './ReliabilityTokens.js';
import { FailureClassifier } from '../failure/FailureClassifier.js';
import { StartupRecoveryManager } from '../startup/StartupRecoveryManager.js';
import { GracefulShutdownCoordinator } from '../shutdown/GracefulShutdownCoordinator.js';
import { KnowledgeReconciliationService } from '../consistency/KnowledgeReconciliationService.js';
import { DisasterRecoveryManager } from '../disaster/DisasterRecoveryManager.js';
import { RecoveryVerifier } from '../verification/RecoveryVerifier.js';
import { DependencyDegradationManager } from '../resilience/DependencyDegradationManager.js';
import { ReliabilityTelemetry } from '../observability/ReliabilityTelemetry.js';

export interface ReliabilityServices {
  readonly failureClassifier: FailureClassifier;
  readonly startupRecovery: StartupRecoveryManager;
  readonly shutdownCoordinator: GracefulShutdownCoordinator;
  readonly reconciliationService: KnowledgeReconciliationService;
  readonly disasterRecovery: DisasterRecoveryManager;
  readonly recoveryVerifier: RecoveryVerifier;
  readonly degradationManager: DependencyDegradationManager;
  readonly telemetry: ReliabilityTelemetry;
}

export class ReliabilityDISetup {
  public static registerReliability(
    container: DIContainer,
    overrides: Partial<ReliabilityServices> = {}
  ): ReliabilityServices {
    const telemetry = overrides.telemetry ?? new ReliabilityTelemetry();
    const failureClassifier = overrides.failureClassifier ?? new FailureClassifier();
    const degradationManager = overrides.degradationManager ?? new DependencyDegradationManager();
    const recoveryVerifier = overrides.recoveryVerifier ?? new RecoveryVerifier();
    const reconciliationService = overrides.reconciliationService ?? new KnowledgeReconciliationService();
    const disasterRecovery = overrides.disasterRecovery ?? new DisasterRecoveryManager(undefined, undefined, undefined, recoveryVerifier);
    const startupRecovery = overrides.startupRecovery ?? new StartupRecoveryManager({ reconciliationService });
    const shutdownCoordinator = overrides.shutdownCoordinator ?? new GracefulShutdownCoordinator();

    container.registerInstance(ReliabilityTokens.ReliabilityTelemetry, telemetry);
    container.registerInstance(ReliabilityTokens.FailureClassifier, failureClassifier);
    container.registerInstance(ReliabilityTokens.DependencyDegradationManager, degradationManager);
    container.registerInstance(ReliabilityTokens.RecoveryVerifier, recoveryVerifier);
    container.registerInstance(ReliabilityTokens.ReconciliationService, reconciliationService);
    container.registerInstance(ReliabilityTokens.DisasterRecoveryManager, disasterRecovery);
    container.registerInstance(ReliabilityTokens.StartupRecoveryManager, startupRecovery);
    container.registerInstance(ReliabilityTokens.GracefulShutdownCoordinator, shutdownCoordinator);

    return {
      telemetry,
      failureClassifier,
      degradationManager,
      recoveryVerifier,
      reconciliationService,
      disasterRecovery,
      startupRecovery,
      shutdownCoordinator,
    };
  }
}
