import type { CascadeAction, DeletionStrategy } from './DataLifecycleTypes.js';
import { StorageCoreError } from '../types/StorageErrors.js';

export interface EntityRelationshipRule {
  readonly parentType: string;
  readonly childType: string;
  readonly onParentDelete: CascadeAction;
}

export class DeletionPolicy {
  private readonly relationshipRules: EntityRelationshipRule[] = [];
  private readonly entityStrategies = new Map<string, DeletionStrategy>();

  constructor() {
    this.registerDefaultCascadeRules();
    this.registerDefaultStrategies();
  }

  public registerRelationshipRule(rule: EntityRelationshipRule): void {
    this.relationshipRules.push(rule);
  }

  public registerStrategy(entityType: string, strategy: DeletionStrategy): void {
    this.entityStrategies.set(entityType, strategy);
  }

  public getStrategy(entityType: string): DeletionStrategy {
    return this.entityStrategies.get(entityType) ?? 'SOFT_DELETE';
  }

  public getCascadeAction(parentType: string, childType: string): CascadeAction {
    const match = this.relationshipRules.find(
      (r) => r.parentType === parentType && r.childType === childType
    );
    return match ? match.onParentDelete : 'RESTRICT';
  }

  public canDelete(entityType: string, isPhysicalPurge: boolean = false): boolean {
    if (entityType === 'AUDIT_EVENT') {
      return false; // Audit events can never be deleted
    }
    return true;
  }

  public assertCanDelete(entityType: string, isPhysicalPurge: boolean = false): void {
    if (!this.canDelete(entityType, isPhysicalPurge)) {
      throw new StorageCoreError(
        `Deletion of entity type '${entityType}' is strictly forbidden by policy.`
      );
    }
  }

  private registerDefaultCascadeRules(): void {
    // Workspace deletion rules:
    // Workspace -> Repository: RESTRICT (cannot delete workspace if it has active repositories)
    this.relationshipRules.push({
      parentType: 'WORKSPACE',
      childType: 'REPOSITORY',
      onParentDelete: 'RESTRICT',
    });

    // Workspace -> Audit: DETACH (audit records survive workspace deletion, marked with historical workspace ID)
    this.relationshipRules.push({
      parentType: 'WORKSPACE',
      childType: 'AUDIT_EVENT',
      onParentDelete: 'DETACH',
    });

    // Repository deletion rules:
    // Repository -> Feature: SOFT_DELETE
    this.relationshipRules.push({
      parentType: 'REPOSITORY',
      childType: 'FEATURE',
      onParentDelete: 'SOFT_DELETE',
    });

    // Repository -> Knowledge: ARCHIVE
    this.relationshipRules.push({
      parentType: 'REPOSITORY',
      childType: 'KNOWLEDGE_UPDATE',
      onParentDelete: 'ARCHIVE',
    });

    // Feature deletion rules:
    // Feature -> Dependency: DETACH (sever relationships without deleting linked features)
    this.relationshipRules.push({
      parentType: 'FEATURE',
      childType: 'FEATURE_DEPENDENCY',
      onParentDelete: 'DETACH',
    });

    // Agent Session -> Task: CASCADE
    this.relationshipRules.push({
      parentType: 'AGENT_SESSION',
      childType: 'AGENT_TASK',
      onParentDelete: 'CASCADE',
    });

    // Task -> Verification: DETACH (verification records preserved for historical evidence)
    this.relationshipRules.push({
      parentType: 'AGENT_TASK',
      childType: 'VERIFICATION_RECORD',
      onParentDelete: 'DETACH',
    });
  }

  private registerDefaultStrategies(): void {
    // Entities that support soft deletion
    this.entityStrategies.set('WORKSPACE', 'SOFT_DELETE');
    this.entityStrategies.set('REPOSITORY', 'SOFT_DELETE');
    this.entityStrategies.set('FEATURE', 'SOFT_DELETE');
    this.entityStrategies.set('AGENT_SESSION', 'SOFT_DELETE');

    // Ephemeral entities that support physical purge
    this.entityStrategies.set('CACHE_ENTRY', 'PHYSICAL_PURGE');
    this.entityStrategies.set('TEMP_BUNDLE', 'PHYSICAL_PURGE');

    // Historical entities that archive before deletion
    this.entityStrategies.set('KNOWLEDGE_UPDATE', 'ARCHIVE_THEN_DELETE');
    this.entityStrategies.set('CONTEXT_SESSION', 'ARCHIVE_THEN_DELETE');
  }
}
