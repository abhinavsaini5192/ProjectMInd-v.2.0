import type { RecoveryVerificationResult } from '../models/RecoveryState.js';

export interface RecoveryVerificationChecks {
  readonly checkStorage?: () => Promise<boolean> | boolean;
  readonly checkSchema?: () => Promise<boolean> | boolean;
  readonly checkIntegrity?: () => Promise<boolean> | boolean;
  readonly checkSecurity?: () => Promise<boolean> | boolean;
  readonly checkJobs?: () => Promise<boolean> | boolean;
  readonly checkEventBus?: () => Promise<boolean> | boolean;
  readonly checkKnowledge?: () => Promise<boolean> | boolean;
}

export class RecoveryVerifier {
  constructor(private readonly checks: RecoveryVerificationChecks = {}) {}

  public async verify(): Promise<RecoveryVerificationResult> {
    const componentsChecked: string[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    const runComponentCheck = async (name: string, check?: () => Promise<boolean> | boolean) => {
      if (!check) return;
      componentsChecked.push(name);
      try {
        const ok = await check();
        if (!ok) {
          errors.push(`Component '${name}' failed verification check`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Component '${name}' check threw exception: ${msg}`);
      }
    };

    // 1. Storage accessible
    await runComponentCheck('storage_accessibility', this.checks.checkStorage);

    // 2. Schema compatibility
    await runComponentCheck('schema_compatibility', this.checks.checkSchema);

    // 3. Storage integrity valid
    await runComponentCheck('storage_integrity', this.checks.checkIntegrity);

    // 4. Security boundaries intact
    await runComponentCheck('security_boundaries', this.checks.checkSecurity);

    // 5. Jobs recoverable
    await runComponentCheck('job_subsystem', this.checks.checkJobs);

    // 6. EventBus functioning
    await runComponentCheck('event_bus', this.checks.checkEventBus);

    // 7. Knowledge consistency
    await runComponentCheck('knowledge_consistency', this.checks.checkKnowledge);

    return {
      isVerified: errors.length === 0,
      componentsChecked,
      errors,
      warnings,
      checkedAt: Date.now(),
    };
  }
}
