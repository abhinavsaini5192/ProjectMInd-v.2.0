import type {
  ITaskDecomposer,
  TaskDecompositionRequest,
} from '../interfaces/ITaskDecomposer.js';
import type { TaskPlanNode } from '../models/TaskPlanNode.js';
import type { TaskType } from '../models/TaskType.js';
import type { TaskPlanDependency } from '../models/TaskPlanDependency.js';

export class TaskDecomposer implements ITaskDecomposer {
  public async decompose(request: TaskDecompositionRequest): Promise<TaskPlanNode[]> {
    const text = `${request.objective} ${request.description ?? ''}`.toLowerCase();
    const now = Date.now();

    const nodes: TaskPlanNode[] = [];
    const max = request.maxSteps ?? 10;

    // Detect work pattern from objective keywords
    if (text.includes('oauth') || text.includes('auth') || text.includes('login') || text.includes('jwt')) {
      // Authentication Pattern (e.g. Google OAuth, JWT Overhaul)
      nodes.push(
        this.createNode({
          id: 'step_1_analysis',
          planId: request.planId,
          index: 1,
          title: 'Analyze Authentication Architecture & Contracts',
          objective: 'Inspect current auth modules, token issuance, and target OAuth provider protocols.',
          taskType: 'ANALYSIS',
          priority: 8,
          dependencies: [],
          preferredRole: 'RESEARCHER',
          capabilities: ['architecture-analysis'],
          features: request.targetFeatures ?? ['auth'],
          resources: request.targetResources ?? ['src/auth'],
          risk: 'LOW',
          request,
          now,
        })
      );

      nodes.push(
        this.createNode({
          id: 'step_2_design',
          planId: request.planId,
          index: 2,
          title: 'Design OAuth Token Flow & API Contracts',
          objective: 'Specify OAuth redirection callback endpoints, token refresh schema, and session cookies.',
          taskType: 'DESIGN',
          priority: 8,
          dependencies: [{ targetNodeId: 'step_1_analysis', type: 'DEPENDS_ON' }],
          preferredRole: 'COORDINATOR',
          capabilities: ['api-design'],
          features: request.targetFeatures ?? ['auth'],
          resources: request.targetResources ?? ['src/auth/contracts'],
          risk: 'MEDIUM',
          request,
          now,
        })
      );

      nodes.push(
        this.createNode({
          id: 'step_3_backend_impl',
          planId: request.planId,
          index: 3,
          title: 'Implement OAuth Backend Provider Service',
          objective: 'Author token verification, user profile extraction, and session token generation.',
          taskType: 'IMPLEMENTATION',
          priority: 9,
          dependencies: [{ targetNodeId: 'step_2_design', type: 'DEPENDS_ON' }],
          preferredRole: 'IMPLEMENTER',
          capabilities: ['typescript', 'backend'],
          features: request.targetFeatures ?? ['auth'],
          resources: ['src/auth/OAuthService.ts', 'src/auth/TokenManager.ts'],
          risk: 'HIGH',
          request,
          now,
        })
      );

      nodes.push(
        this.createNode({
          id: 'step_4_frontend_ui',
          planId: request.planId,
          index: 4,
          title: 'Implement Frontend OAuth Login Integration',
          objective: 'Add OAuth sign-in button, callback redirect handlers, and client state dispatch.',
          taskType: 'UI',
          priority: 7,
          dependencies: [{ targetNodeId: 'step_2_design', type: 'DEPENDS_ON' }],
          preferredRole: 'IMPLEMENTER',
          capabilities: ['frontend', 'react'],
          features: request.targetFeatures ?? ['auth'],
          resources: ['src/ui/LoginButton.tsx', 'src/ui/AuthCallback.tsx'],
          risk: 'MEDIUM',
          request,
          now,
        })
      );

      nodes.push(
        this.createNode({
          id: 'step_5_integration_tests',
          planId: request.planId,
          index: 5,
          title: 'Integration & Security Test Suite',
          objective: 'Verify end-to-end OAuth flow with mock provider, token validation, and expiry handling.',
          taskType: 'TESTING',
          priority: 8,
          dependencies: [
            { targetNodeId: 'step_3_backend_impl', type: 'DEPENDS_ON' },
            { targetNodeId: 'step_4_frontend_ui', type: 'DEPENDS_ON' },
          ],
          preferredRole: 'TESTER',
          capabilities: ['testing', 'integration-testing'],
          features: request.targetFeatures ?? ['auth'],
          resources: ['tests/auth/oauth.test.ts'],
          risk: 'LOW',
          request,
          now,
        })
      );

      nodes.push(
        this.createNode({
          id: 'step_6_verification',
          planId: request.planId,
          index: 6,
          title: 'System Build & Verification Gating',
          objective: 'Run automated build, linter, regression tests, and security boundary assertions.',
          taskType: 'VERIFICATION',
          priority: 10,
          dependencies: [{ targetNodeId: 'step_5_integration_tests', type: 'VERIFIES' }],
          preferredRole: 'TESTER',
          capabilities: ['verification', 'ci-check'],
          features: request.targetFeatures ?? ['auth'],
          resources: [],
          risk: 'LOW',
          request,
          now,
        })
      );

      nodes.push(
        this.createNode({
          id: 'step_7_documentation',
          planId: request.planId,
          index: 7,
          title: 'Update OAuth Architecture & Setup Documentation',
          objective: 'Document OAuth provider credentials, environment variables, and client flow.',
          taskType: 'DOCUMENTATION',
          priority: 5,
          dependencies: [{ targetNodeId: 'step_6_verification', type: 'DEPENDS_ON' }],
          preferredRole: 'DOCUMENTATION',
          capabilities: ['markdown', 'docs'],
          features: request.targetFeatures ?? ['auth'],
          resources: ['docs/auth/OAUTH_SETUP.md'],
          risk: 'LOW',
          request,
          now,
        })
      );
    } else if (text.includes('database') || text.includes('migration') || text.includes('schema') || text.includes('sql')) {
      // Database / Schema Migration Pattern
      nodes.push(
        this.createNode({
          id: 'step_1_schema_analysis',
          planId: request.planId,
          index: 1,
          title: 'Analyze Database Schema & Dependencies',
          objective: 'Examine current relational entities, indices, and data volume constraints.',
          taskType: 'ANALYSIS',
          priority: 8,
          dependencies: [],
          preferredRole: 'RESEARCHER',
          capabilities: ['sql', 'database-analysis'],
          features: request.targetFeatures ?? ['database'],
          resources: request.targetResources ?? ['src/database/schema.ts'],
          risk: 'MEDIUM',
          request,
          now,
        })
      );

      nodes.push(
        this.createNode({
          id: 'step_2_migration_script',
          planId: request.planId,
          index: 2,
          title: 'Author Up/Down Schema Migration Script',
          objective: 'Generate deterministic migration script with rollback support and data preservation.',
          taskType: 'DATABASE',
          priority: 9,
          dependencies: [{ targetNodeId: 'step_1_schema_analysis', type: 'DEPENDS_ON' }],
          preferredRole: 'IMPLEMENTER',
          capabilities: ['sql', 'migrations'],
          features: request.targetFeatures ?? ['database'],
          resources: ['src/database/migrations/'],
          risk: 'HIGH',
          request,
          now,
          requireApproval: true,
        })
      );

      nodes.push(
        this.createNode({
          id: 'step_3_dao_update',
          planId: request.planId,
          index: 3,
          title: 'Update Data Access Objects & Repository Mappings',
          objective: 'Sync ORM / repository queries with new columns and entity constraints.',
          taskType: 'IMPLEMENTATION',
          priority: 8,
          dependencies: [{ targetNodeId: 'step_2_migration_script', type: 'DEPENDS_ON' }],
          preferredRole: 'IMPLEMENTER',
          capabilities: ['typescript', 'orm'],
          features: request.targetFeatures ?? ['database'],
          resources: ['src/database/repositories/'],
          risk: 'MEDIUM',
          request,
          now,
        })
      );

      nodes.push(
        this.createNode({
          id: 'step_4_schema_verification',
          planId: request.planId,
          index: 4,
          title: 'Verify Migration Integrity & Query Tests',
          objective: 'Execute test suite on isolated test database instance and verify rollback stability.',
          taskType: 'VERIFICATION',
          priority: 10,
          dependencies: [{ targetNodeId: 'step_3_dao_update', type: 'VERIFIES' }],
          preferredRole: 'TESTER',
          capabilities: ['testing', 'verification'],
          features: request.targetFeatures ?? ['database'],
          resources: [],
          risk: 'LOW',
          request,
          now,
        })
      );
    } else if (text.includes('fix') || text.includes('bug') || text.includes('error') || text.includes('crash')) {
      // Bug Fix Pattern
      nodes.push(
        this.createNode({
          id: 'step_1_investigate',
          planId: request.planId,
          index: 1,
          title: 'Investigate Failure & Root Cause Analysis',
          objective: 'Inspect stack traces, error boundaries, and anomalous runtime logs.',
          taskType: 'INVESTIGATION',
          priority: 9,
          dependencies: [],
          preferredRole: 'RESEARCHER',
          capabilities: ['debugging'],
          features: request.targetFeatures ?? [],
          resources: request.targetResources ?? [],
          risk: 'LOW',
          request,
          now,
        })
      );

      nodes.push(
        this.createNode({
          id: 'step_2_repro_test',
          planId: request.planId,
          index: 2,
          title: 'Author Failing Reproducer Test Case',
          objective: 'Write deterministic automated test isolating the bug condition.',
          taskType: 'TESTING',
          priority: 8,
          dependencies: [{ targetNodeId: 'step_1_investigate', type: 'DEPENDS_ON' }],
          preferredRole: 'TESTER',
          capabilities: ['testing'],
          features: request.targetFeatures ?? [],
          resources: [],
          risk: 'LOW',
          request,
          now,
        })
      );

      nodes.push(
        this.createNode({
          id: 'step_3_fix_implementation',
          planId: request.planId,
          index: 3,
          title: 'Apply Code Fix & Guards',
          objective: 'Modify code to handle the root cause and guard against edge cases.',
          taskType: 'IMPLEMENTATION',
          priority: 9,
          dependencies: [{ targetNodeId: 'step_2_repro_test', type: 'DEPENDS_ON' }],
          preferredRole: 'IMPLEMENTER',
          capabilities: ['typescript'],
          features: request.targetFeatures ?? [],
          resources: request.targetResources ?? [],
          risk: 'MEDIUM',
          request,
          now,
        })
      );

      nodes.push(
        this.createNode({
          id: 'step_4_verify_fix',
          planId: request.planId,
          index: 4,
          title: 'Verify Bug Resolution & Regression Check',
          objective: 'Run test suite to verify reproducer passes and existing tests remain green.',
          taskType: 'VERIFICATION',
          priority: 10,
          dependencies: [{ targetNodeId: 'step_3_fix_implementation', type: 'VERIFIES' }],
          preferredRole: 'TESTER',
          capabilities: ['verification'],
          features: request.targetFeatures ?? [],
          resources: [],
          risk: 'LOW',
          request,
          now,
        })
      );
    } else {
      // General / Standard Feature Pattern
      nodes.push(
        this.createNode({
          id: 'step_1_analysis',
          planId: request.planId,
          index: 1,
          title: `Analyze Scope: ${request.objective.slice(0, 50)}`,
          objective: `Investigate codebase and establish constraints for '${request.objective}'.`,
          taskType: 'ANALYSIS',
          priority: 7,
          dependencies: [],
          preferredRole: 'RESEARCHER',
          capabilities: ['analysis'],
          features: request.targetFeatures ?? [],
          resources: request.targetResources ?? [],
          risk: 'LOW',
          request,
          now,
        })
      );

      nodes.push(
        this.createNode({
          id: 'step_2_implementation',
          planId: request.planId,
          index: 2,
          title: `Implement Solution: ${request.objective.slice(0, 50)}`,
          objective: `Author code changes fulfilling '${request.objective}'.`,
          taskType: 'IMPLEMENTATION',
          priority: 8,
          dependencies: [{ targetNodeId: 'step_1_analysis', type: 'DEPENDS_ON' }],
          preferredRole: 'IMPLEMENTER',
          capabilities: ['typescript'],
          features: request.targetFeatures ?? [],
          resources: request.targetResources ?? [],
          risk: 'MEDIUM',
          request,
          now,
        })
      );

      nodes.push(
        this.createNode({
          id: 'step_3_testing',
          planId: request.planId,
          index: 3,
          title: 'Author Tests for Implementation',
          objective: 'Create unit and integration test assertions verifying the implementation.',
          taskType: 'TESTING',
          priority: 7,
          dependencies: [{ targetNodeId: 'step_2_implementation', type: 'DEPENDS_ON' }],
          preferredRole: 'TESTER',
          capabilities: ['testing'],
          features: request.targetFeatures ?? [],
          resources: [],
          risk: 'LOW',
          request,
          now,
        })
      );

      nodes.push(
        this.createNode({
          id: 'step_4_verification',
          planId: request.planId,
          index: 4,
          title: 'System Verification',
          objective: 'Run automated build and regression verification on modified components.',
          taskType: 'VERIFICATION',
          priority: 10,
          dependencies: [{ targetNodeId: 'step_3_testing', type: 'VERIFIES' }],
          preferredRole: 'TESTER',
          capabilities: ['verification'],
          features: request.targetFeatures ?? [],
          resources: [],
          risk: 'LOW',
          request,
          now,
        })
      );
    }

    return nodes.slice(0, max);
  }

  private createNode(params: {
    id: string;
    planId: string;
    index: number;
    title: string;
    objective: string;
    taskType: TaskType;
    priority: number;
    dependencies: readonly TaskPlanDependency[];
    preferredRole: string;
    capabilities: readonly string[];
    features: readonly string[];
    resources: readonly string[];
    risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    request: TaskDecompositionRequest;
    now: number;
    requireApproval?: boolean;
  }): TaskPlanNode {
    return {
      id: params.id,
      planId: params.planId,
      taskId: `task_${params.planId}_${params.index}`,
      title: params.title,
      objective: params.objective,
      description: params.objective,
      taskType: params.taskType,
      status: 'PENDING',
      priority: params.priority,
      dependencies: params.dependencies,
      requiredCapabilities: params.capabilities,
      preferredAgentRole: params.preferredRole,
      affectedFeatures: params.features,
      affectedResources: params.resources,
      requiredContext: {
        workspaceId: params.request.workspaceId,
        projectId: params.request.projectId,
        repositoryIds: params.request.repositoryIds,
        targetFeatures: params.features,
        targetResources: params.resources,
      },
      verificationPolicy:
        params.taskType === 'VERIFICATION' ||
        params.taskType === 'TESTING' ||
        params.taskType === 'IMPLEMENTATION' ||
        params.taskType === 'DATABASE'
          ? {
              requiredVerifications: ['UNIT_TEST', 'BUILD'],
              policies: ['UNIT_TEST', 'BUILD'],
              blocking: true,
              requiresHumanApproval: params.requireApproval ?? false,
            }
          : undefined,
      risk: params.risk,
      constraints: [],
      approval: params.requireApproval
        ? {
            status: 'APPROVAL_REQUIRED',
            requiredByPolicy: 'HIGH_RISK_CHANGE',
          }
        : {
            status: 'NOT_REQUIRED',
          },
      createdAt: params.now,
      updatedAt: params.now,
      retryCount: 0,
      maxRetries: 3,
    };
  }

  public async decomposePlan(request: Partial<TaskDecompositionRequest> & {
    readonly workspaceId: string;
    readonly projectId: string;
    readonly title: string;
    readonly objective: string;
    readonly createdBy?: string | undefined;
    readonly repositoryIds?: readonly string[] | undefined;
  }): Promise<import('../models/CanonicalTaskPlan.js').CanonicalTaskPlan> {
    const planId = request.planId ?? `plan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nodes = await this.decompose({
      planId,
      workspaceId: request.workspaceId,
      projectId: request.projectId,
      repositoryIds: request.repositoryIds ?? ['default'],
      objective: request.objective,
      description: request.description,
      targetFeatures: request.targetFeatures,
      targetResources: request.targetResources,
      maxSteps: request.maxSteps,
    });

    return {
      id: planId,
      workspaceId: request.workspaceId,
      projectId: request.projectId,
      repositoryIds: request.repositoryIds ?? ['default'],
      rootTaskId: nodes[0]?.id ?? 'root',
      title: request.title,
      objective: request.objective,
      description: request.description,
      status: 'DRAFT',
      version: 1,
      nodes,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: request.createdBy ?? 'SYSTEM',
      source: 'TaskDecomposer',
      provenance: 'SYSTEM_DECOMPOSED',
      confidence: 1.0,
      constraints: [],
      planRevision: 1,
    };
  }
}
