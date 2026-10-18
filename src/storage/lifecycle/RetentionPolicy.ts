import type {
  DataLifecycleState,
  LifecycleEntity,
  LifecycleEvaluationResult,
} from './DataLifecycleTypes.js';

export interface RetentionRule {
  readonly name: string;
  readonly entityType: string;
  readonly staleAfterMs?: number | undefined;
  readonly archivableAfterMs?: number | undefined;
  readonly deletableAfterMs?: number | undefined;
  readonly immutable?: boolean | undefined;
  readonly customEvaluator?: ((entity: LifecycleEntity) => DataLifecycleState | null) | undefined;
}

export class RetentionPolicy {
  private readonly rules = new Map<string, RetentionRule>();

  constructor(initialRules: readonly RetentionRule[] = []) {
    for (const rule of initialRules) {
      this.registerRule(rule);
    }
    this.registerDefaultRules();
  }

  public registerRule(rule: RetentionRule): void {
    this.rules.set(rule.entityType, rule);
  }

  public getRule(entityType: string): RetentionRule | undefined {
    return this.rules.get(entityType);
  }

  public evaluate(entity: LifecycleEntity, currentTime: number = Date.now()): LifecycleEvaluationResult {
    const rule = this.rules.get(entity.entityType);

    if (!rule) {
      return {
        entityType: entity.entityType,
        entityId: entity.entityId,
        currentState: entity.state,
        recommendedState: entity.state,
        reason: 'No retention rule defined for entity type; preserving data state by default.',
      };
    }

    if (rule.immutable) {
      return {
        entityType: entity.entityType,
        entityId: entity.entityId,
        currentState: entity.state,
        recommendedState: entity.state === 'DELETED' ? 'ACTIVE' : entity.state,
        reason: 'Entity type is designated as IMMUTABLE. Deletion is forbidden by retention policy.',
        matchedRuleName: rule.name,
      };
    }

    if (rule.customEvaluator) {
      const customState = rule.customEvaluator(entity);
      if (customState) {
        return {
          entityType: entity.entityType,
          entityId: entity.entityId,
          currentState: entity.state,
          recommendedState: customState,
          reason: `Evaluated by custom retention logic in rule '${rule.name}'.`,
          matchedRuleName: rule.name,
        };
      }
    }

    const ageMs = currentTime - entity.createdAt;

    if (rule.deletableAfterMs && ageMs >= rule.deletableAfterMs) {
      return {
        entityType: entity.entityType,
        entityId: entity.entityId,
        currentState: entity.state,
        recommendedState: 'DELETABLE',
        reason: `Entity age (${Math.round(ageMs / 1000)}s) exceeds deletable threshold (${Math.round(rule.deletableAfterMs / 1000)}s).`,
        matchedRuleName: rule.name,
      };
    }

    if (rule.archivableAfterMs && ageMs >= rule.archivableAfterMs) {
      return {
        entityType: entity.entityType,
        entityId: entity.entityId,
        currentState: entity.state,
        recommendedState: 'ARCHIVABLE',
        reason: `Entity age (${Math.round(ageMs / 1000)}s) exceeds archivable threshold (${Math.round(rule.archivableAfterMs / 1000)}s).`,
        matchedRuleName: rule.name,
      };
    }

    if (rule.staleAfterMs && ageMs >= rule.staleAfterMs) {
      return {
        entityType: entity.entityType,
        entityId: entity.entityId,
        currentState: entity.state,
        recommendedState: 'STALE',
        reason: `Entity age (${Math.round(ageMs / 1000)}s) exceeds staleness threshold (${Math.round(rule.staleAfterMs / 1000)}s).`,
        matchedRuleName: rule.name,
      };
    }

    return {
      entityType: entity.entityType,
      entityId: entity.entityId,
      currentState: entity.state,
      recommendedState: 'ACTIVE',
      reason: 'Entity is within active retention threshold.',
      matchedRuleName: rule.name,
    };
  }

  private registerDefaultRules(): void {
    // Audit records are strictly IMMUTABLE: cannot be marked deletable
    if (!this.rules.has('AUDIT_EVENT')) {
      this.registerRule({
        name: 'default_audit_retention',
        entityType: 'AUDIT_EVENT',
        immutable: true,
      });
    }

    // Context sessions: become stale after 24h, archivable after 7 days, deletable after 30 days
    if (!this.rules.has('CONTEXT_SESSION')) {
      this.registerRule({
        name: 'default_context_session_retention',
        entityType: 'CONTEXT_SESSION',
        staleAfterMs: 24 * 60 * 60 * 1000,
        archivableAfterMs: 7 * 24 * 60 * 60 * 1000,
        deletableAfterMs: 30 * 24 * 60 * 60 * 1000,
      });
    }

    // Agent checkpoints: stale after 48h, archivable after 14 days, deletable after 60 days
    if (!this.rules.has('AGENT_CHECKPOINT')) {
      this.registerRule({
        name: 'default_agent_checkpoint_retention',
        entityType: 'AGENT_CHECKPOINT',
        staleAfterMs: 48 * 60 * 60 * 1000,
        archivableAfterMs: 14 * 24 * 60 * 60 * 1000,
        deletableAfterMs: 60 * 24 * 60 * 60 * 1000,
      });
    }
  }
}
