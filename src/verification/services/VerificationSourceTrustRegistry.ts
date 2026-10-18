import type { VerificationSource } from '../models/VerificationSource.js';
import type {
  VerificationProvenance,
  VerificationTrustLevel,
  VerificationLevel,
} from '../models/VerificationProvenance.js';
import type { IVerificationSource } from '../interfaces/IVerificationSource.js';
import type {
  IVerificationSourceTrustRegistry,
  SourceTrustPolicy,
} from '../interfaces/IVerificationSourceTrustRegistry.js';

export class VerificationSourceTrustRegistry implements IVerificationSourceTrustRegistry {
  private readonly sources = new Map<string, IVerificationSource>();
  private readonly policies = new Map<VerificationSource, SourceTrustPolicy>();

  constructor() {
    this.initDefaultPolicies();
  }

  private initDefaultPolicies(): void {
    this.policies.set('CI', {
      sourceType: 'CI',
      defaultTrustLevel: 'AUTHORITATIVE',
      defaultVerificationLevel: 'SYSTEM_VERIFIED',
      isAllowedToVerifyTasks: true,
    });

    this.policies.set('BUILD_SYSTEM', {
      sourceType: 'BUILD_SYSTEM',
      defaultTrustLevel: 'TRUSTED',
      defaultVerificationLevel: 'SYSTEM_VERIFIED',
      isAllowedToVerifyTasks: true,
    });

    this.policies.set('TEST_RUNNER', {
      sourceType: 'TEST_RUNNER',
      defaultTrustLevel: 'TRUSTED',
      defaultVerificationLevel: 'SYSTEM_VERIFIED',
      isAllowedToVerifyTasks: true,
    });

    this.policies.set('AGENT', {
      sourceType: 'AGENT',
      defaultTrustLevel: 'SEMI_TRUSTED',
      defaultVerificationLevel: 'AGENT_REPORTED',
      isAllowedToVerifyTasks: false,
    });

    this.policies.set('MCP', {
      sourceType: 'MCP',
      defaultTrustLevel: 'SEMI_TRUSTED',
      defaultVerificationLevel: 'AGENT_REPORTED',
      isAllowedToVerifyTasks: false,
    });

    this.policies.set('IDE', {
      sourceType: 'IDE',
      defaultTrustLevel: 'SEMI_TRUSTED',
      defaultVerificationLevel: 'SYSTEM_OBSERVED',
      isAllowedToVerifyTasks: false,
    });

    this.policies.set('MANUAL', {
      sourceType: 'MANUAL',
      defaultTrustLevel: 'TRUSTED',
      defaultVerificationLevel: 'MANUALLY_CONFIRMED',
      isAllowedToVerifyTasks: true,
    });

    this.policies.set('SYSTEM', {
      sourceType: 'SYSTEM',
      defaultTrustLevel: 'AUTHORITATIVE',
      defaultVerificationLevel: 'SYSTEM_VERIFIED',
      isAllowedToVerifyTasks: true,
    });

    this.policies.set('UNKNOWN', {
      sourceType: 'UNKNOWN',
      defaultTrustLevel: 'UNTRUSTED',
      defaultVerificationLevel: 'UNKNOWN',
      isAllowedToVerifyTasks: false,
    });
  }

  public registerSource(source: IVerificationSource): void {
    this.sources.set(source.getSourceId(), source);
  }

  public getSource(sourceId: string): IVerificationSource | undefined {
    return this.sources.get(sourceId);
  }

  public configureTrustPolicy(sourceType: VerificationSource, policy: SourceTrustPolicy): void {
    this.policies.set(sourceType, policy);
  }

  public getTrustPolicy(sourceType: VerificationSource): SourceTrustPolicy {
    return (
      this.policies.get(sourceType) ?? {
        sourceType,
        defaultTrustLevel: 'UNTRUSTED',
        defaultVerificationLevel: 'UNKNOWN',
        isAllowedToVerifyTasks: false,
      }
    );
  }

  public resolveProvenance(
    sourceType: VerificationSource,
    reportedBy: string,
    providedSourceId?: string | undefined,
    observedAt?: string | undefined
  ): VerificationProvenance {
    const receivedAt = new Date().toISOString();

    // 1. Check if an explicit registered source exists
    if (providedSourceId && this.sources.has(providedSourceId)) {
      const registered = this.sources.get(providedSourceId)!;
      return {
        source: registered.getSourceType(),
        reportedBy: reportedBy || providedSourceId,
        receivedAt,
        observedAt: observedAt ?? receivedAt,
        verificationLevel: registered.getVerificationLevel(),
        trustLevel: registered.getTrustLevel(),
      };
    }

    // 2. Fall back to configured policy for the source type
    const policy = this.getTrustPolicy(sourceType);

    return {
      source: sourceType,
      reportedBy: reportedBy || sourceType,
      receivedAt,
      observedAt: observedAt ?? receivedAt,
      verificationLevel: policy.defaultVerificationLevel,
      trustLevel: policy.defaultTrustLevel,
    };
  }
}
