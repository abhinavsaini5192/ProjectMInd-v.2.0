import type { ITaskPlanValidator } from '../interfaces/ITaskPlanValidator.js';
import type { ITaskDependencyResolver } from '../interfaces/ITaskDependencyResolver.js';
import type { CanonicalTaskPlan } from '../models/CanonicalTaskPlan.js';
import type { PlanValidationResult } from '../models/PlanValidationResult.js';
import { TaskTypes } from '../models/TaskType.js';

import { TaskDependencyResolver } from './TaskDependencyResolver.js';

export class TaskPlanValidator implements ITaskPlanValidator {
  private readonly dependencyResolver: ITaskDependencyResolver;

  constructor(dependencyResolver?: ITaskDependencyResolver | unknown) {
    if (dependencyResolver && typeof (dependencyResolver as any).detectCycles === 'function') {
      this.dependencyResolver = dependencyResolver as ITaskDependencyResolver;
    } else {
      this.dependencyResolver = new TaskDependencyResolver();
    }
  }

  public async validate(plan: CanonicalTaskPlan): Promise<PlanValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const conflicts: string[] = [];
    const missingInformation: string[] = [];
    const staleReferences: string[] = [];
    const securityViolations: string[] = [];
    const dependencyIssues: string[] = [];
    const verificationIssues: string[] = [];

    // 1. Scope and Identity Checks
    if (!plan.id || plan.id.trim().length === 0) {
      errors.push('Plan must have a valid non-empty id.');
    }
    if (!plan.workspaceId || plan.workspaceId.trim().length === 0) {
      securityViolations.push('Plan is missing required workspaceId scope.');
      errors.push('Plan workspaceId scope is required.');
    }
    if (!plan.projectId || plan.projectId.trim().length === 0) {
      securityViolations.push('Plan is missing required projectId scope.');
      errors.push('Plan projectId scope is required.');
    }
    if (!plan.title || plan.title.trim().length === 0) {
      missingInformation.push('Plan title is missing.');
      errors.push('Plan title is required.');
    }
    if (!plan.objective || plan.objective.trim().length === 0) {
      missingInformation.push('Plan objective is missing.');
      errors.push('Plan objective is required.');
    }

    // 2. Node Counts and Uniqueness
    if (!plan.nodes || plan.nodes.length === 0) {
      errors.push('Plan must contain at least one task node.');
      return {
        valid: false,
        errors,
        warnings,
        conflicts,
        missingInformation,
        staleReferences,
        securityViolations,
        dependencyIssues,
        verificationIssues,
      };
    }

    const nodeIds = new Set<string>();
    const taskIds = new Set<string>();
    for (const node of plan.nodes) {
      if (nodeIds.has(node.id)) {
        errors.push(`Duplicate task node ID '${node.id}' in plan.`);
      }
      nodeIds.add(node.id);

      if (taskIds.has(node.taskId)) {
        warnings.push(`Duplicate taskId '${node.taskId}' shared by multiple nodes.`);
      }
      taskIds.add(node.taskId);

      // Validate task type taxonomy
      if (!TaskTypes.includes(node.taskType)) {
        errors.push(`Task node '${node.id}' has unsupported taskType '${node.taskType}'.`);
      }

      // Check risk vs approval requirement
      if (node.risk === 'CRITICAL' && node.approval?.status === 'NOT_REQUIRED') {
        warnings.push(`CRITICAL risk task '${node.id}' does not require human approval.`);
      }
    }

    // 3. Dependency Integrity
    for (const node of plan.nodes) {
      for (const dep of node.dependencies) {
        if (!nodeIds.has(dep.targetNodeId)) {
          dependencyIssues.push(
            `Task node '${node.id}' depends on missing target node '${dep.targetNodeId}'.`
          );
          errors.push(`Missing dependency target node '${dep.targetNodeId}' referenced by '${node.id}'.`);
        }
        if (dep.targetNodeId === node.id) {
          dependencyIssues.push(`Self-referential dependency detected on task node '${node.id}'.`);
          errors.push(`Task node '${node.id}' cannot depend on itself.`);
        }
      }
    }

    // 4. Cycle Detection
    const cycles = this.dependencyResolver.detectCycles(plan.nodes);
    if (cycles.length > 0) {
      for (const cycle of cycles) {
        dependencyIssues.push(`Dependency cycle detected: ${cycle.join(' -> ')}`);
        errors.push(`Circular dependency detected: ${cycle.join(' -> ')}`);
      }
    }

    // 5. Verification Gating Validation
    const modificationTypes = new Set(['IMPLEMENTATION', 'DATABASE', 'REFACTOR', 'MIGRATION']);
    for (const node of plan.nodes) {
      if (modificationTypes.has(node.taskType)) {
        const hasDirectPolicy =
          node.verificationPolicy &&
          ((node.verificationPolicy.requiredVerifications &&
            node.verificationPolicy.requiredVerifications.length > 0) ||
            (node.verificationPolicy.policies && node.verificationPolicy.policies.length > 0));
        const hasDownstreamVerification = this.hasDownstreamVerificationNode(node.id, plan.nodes);

        if (!hasDirectPolicy && !hasDownstreamVerification) {
          verificationIssues.push(
            `Modification task '${node.id}' (${node.taskType}) lacks verification requirement or downstream verification step.`
          );
          warnings.push(`Task '${node.id}' modifies code but has no associated verification policy.`);
        }
      }
    }

    // 6. Conflicting Resource Checks
    for (let i = 0; i < plan.nodes.length; i++) {
      for (let j = i + 1; j < plan.nodes.length; j++) {
        const a = plan.nodes[i]!;
        const b = plan.nodes[j]!;

        // If nodes share affected resources, they should not be declared parallel
        const sharedResources = a.affectedResources.filter((r) => b.affectedResources.includes(r));
        if (sharedResources.length > 0) {
          const aDependsOnB = a.dependencies.some((d) => d.targetNodeId === b.id);
          const bDependsOnA = b.dependencies.some((d) => d.targetNodeId === a.id);

          if (!aDependsOnB && !bDependsOnA) {
            conflicts.push(
              `Tasks '${a.id}' and '${b.id}' modify overlapping resources [${sharedResources.join(', ')}] without an explicit dependency order.`
            );
          }
        }
      }
    }

    const valid = errors.length === 0;

    return {
      valid,
      errors,
      warnings,
      conflicts,
      missingInformation,
      staleReferences,
      securityViolations,
      dependencyIssues,
      verificationIssues,
    };
  }

  private hasDownstreamVerificationNode(
    sourceNodeId: string,
    allNodes: readonly import('../models/TaskPlanNode.js').TaskPlanNode[]
  ): boolean {
    const dependents = allNodes.filter((n) =>
      n.dependencies.some((d) => d.targetNodeId === sourceNodeId)
    );

    for (const dep of dependents) {
      if (dep.taskType === 'VERIFICATION' || dep.taskType === 'TESTING') {
        return true;
      }
      if (this.hasDownstreamVerificationNode(dep.id, allNodes)) {
        return true;
      }
    }

    return false;
  }
}
