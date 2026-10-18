import type { CLICommand, CLICommandHelp } from '../core/CLICommand.js';
import type { CLIContext } from '../core/CLIContext.js';
import { type CLIResult, createSuccessResult, createErrorResult } from '../core/CLIResult.js';
import { CLIExitCode } from '../core/CLIExitCode.js';
import type { ITaskPlannerService } from '../../agent/planning/interfaces/ITaskPlanner.js';
import { TaskPlannerService } from '../../agent/planning/services/TaskPlannerService.js';
import { InMemoryTaskPlanStore } from '../../agent/planning/services/InMemoryTaskPlanStore.js';
import { TaskDecomposer } from '../../agent/planning/services/TaskDecomposer.js';
import { TaskDependencyResolver } from '../../agent/planning/services/TaskDependencyResolver.js';
import { TaskPlanValidator } from '../../agent/planning/services/TaskPlanValidator.js';
import { TaskReadinessEvaluator } from '../../agent/planning/services/TaskReadinessEvaluator.js';
import { TaskPrioritizer } from '../../agent/planning/services/TaskPrioritizer.js';
import { TaskAssignmentResolver } from '../../agent/planning/services/TaskAssignmentResolver.js';
import { ApprovalGateResolver } from '../../agent/planning/services/ApprovalGateResolver.js';
import { TaskOrchestrator } from '../../agent/planning/services/TaskOrchestrator.js';
import { TaskCheckpointManager } from '../../agent/planning/services/TaskCheckpointManager.js';
import { TaskPlanRevisionManager } from '../../agent/planning/services/TaskPlanRevisionManager.js';

export class PlanCommand implements CLICommand {
  public readonly name = 'plan';
  public readonly description = 'Task planning and execution orchestration (Phase 9.6)';
  public readonly aliases: readonly string[] = ['planner', 'plans'];

  public readonly help: CLICommandHelp = {
    summary: 'Decompose objectives, validate task dependency DAGs, evaluate readiness, and orchestrate execution.',
    usage: 'projectmind plan <subcommand> [args] [options]',
    examples: [
      'projectmind plan list',
      'projectmind plan create "Add OAuth Google Login" "Integrate Google OAuth token flow"',
      'projectmind plan inspect plan_12345',
      'projectmind plan validate plan_12345',
      'projectmind plan tasks plan_12345',
      'projectmind plan ready plan_12345',
      'projectmind plan blocked plan_12345',
      'projectmind plan start plan_12345',
      'projectmind plan pause plan_12345',
      'projectmind plan resume plan_12345',
      'projectmind plan cancel plan_12345',
      'projectmind plan advance plan_12345',
      'projectmind plan explain plan_12345',
    ],
    subcommands: [
      { name: 'list', description: 'List task plans in workspace/project' },
      { name: 'create', description: 'Create and decompose a new task plan' },
      { name: 'inspect', description: 'Inspect plan details and progress' },
      { name: 'validate', description: 'Validate plan dependencies, cycles, and policies' },
      { name: 'tasks', description: 'List all task nodes in a plan' },
      { name: 'ready', description: 'List tasks currently ready for execution' },
      { name: 'blocked', description: 'List tasks currently blocked or waiting' },
      { name: 'start', description: 'Start plan execution' },
      { name: 'pause', description: 'Pause plan execution' },
      { name: 'resume', description: 'Resume paused plan execution' },
      { name: 'cancel', description: 'Cancel plan execution' },
      { name: 'advance', description: 'Advance plan and evaluate eligible tasks' },
      { name: 'explain', description: 'Explain plan critical path, priority scores, and bottlenecks' },
    ],
    options: [
      { name: 'json', description: 'Output results formatted as JSON', type: 'boolean' },
      { name: 'project', description: 'Project ID scope', type: 'string' },
    ],
  };

  private readonly service: ITaskPlannerService;

  constructor(service?: ITaskPlannerService | undefined) {
    if (service) {
      this.service = service;
    } else {
      const store = new InMemoryTaskPlanStore();
      const decomposer = new TaskDecomposer();
      const depResolver = new TaskDependencyResolver();
      const validator = new TaskPlanValidator(depResolver);
      const readiness = new TaskReadinessEvaluator();
      const prioritizer = new TaskPrioritizer();
      const assignResolver = new TaskAssignmentResolver();
      const approvalResolver = new ApprovalGateResolver();
      const orchestrator = new TaskOrchestrator({
        store,
        readinessEvaluator: readiness,
        assignmentResolver: assignResolver,
        prioritizer,
        validator,
      });
      const checkpointManager = new TaskCheckpointManager(store);
      const revisionManager = new TaskPlanRevisionManager(store);

      this.service = new TaskPlannerService(
        store,
        decomposer,
        validator,
        depResolver,
        readiness,
        prioritizer,
        approvalResolver,
        orchestrator,
        checkpointManager,
        revisionManager
      );
    }
  }

  public async execute(context: CLIContext): Promise<CLIResult> {
    const subcommand = context.args[0] ?? 'list';
    const targetId = context.args[1];

    switch (subcommand) {
      case 'list': {
        const projectId = context.options['project'] ? String(context.options['project']) : undefined;
        const plans = await this.service.listPlans({
          workspaceId: context.workspacePath ?? 'default',
          projectId,
        });

        if (context.format === 'json' || context.options['json']) {
          return createSuccessResult(this.name, { count: plans.length, total: plans.length, plans });
        }

        const lines = [`Active Task Plans (${plans.length}):`, ''];
        if (plans.length === 0) {
          lines.push('  No active task plans found.');
        } else {
          for (const p of plans) {
            lines.push(`  ${p.id} — ${p.title}`);
            lines.push(`    Status: ${p.status} | Nodes: ${p.nodes.length} | Rev: v${p.planRevision}`);
            lines.push(`    Project: ${p.projectId} | Workspace: ${p.workspaceId}`);
            lines.push('');
          }
        }
        return createSuccessResult(this.name, { plans, total: plans.length }, lines.join('\n'));
      }

      case 'create': {
        const title = (context.options['title'] ? String(context.options['title']) : context.args[1]);
        if (!title) {
          return createErrorResult(
            this.name,
            CLIExitCode.INVALID_ARGUMENT,
            'Missing plan title. Usage: projectmind plan create <title> [objective] or --title <t> --objective <o>'
          );
        }
        const objective = (context.options['objective'] ? String(context.options['objective']) : (context.args[2] ?? title));

        const projectId = context.options['project'] ? String(context.options['project']) : 'default_project';
        const workspaceId = context.options['workspace'] ? String(context.options['workspace']) : (context.workspacePath ?? 'default');
        const plan = await this.service.createPlan({
          workspaceId,
          projectId,
          title,
          objective,
          createdBy: 'cli_user',
        });

        const createPayload = { ...plan, planId: plan.id, taskCount: plan.nodes.length };
        if (context.format === 'json' || context.options['json']) {
          return createSuccessResult(this.name, createPayload);
        }

        const lines = [
          `Task Plan Created: ${plan.title}`,
          `  ID: ${plan.id}`,
          `  Status: ${plan.status}`,
          `  Tasks Decomposed: ${plan.nodes.length}`,
        ];
        return createSuccessResult(this.name, createPayload, lines.join('\n'));
      }

      case 'inspect':
      case 'show': {
        if (!targetId) {
          return createErrorResult(
            this.name,
            CLIExitCode.INVALID_ARGUMENT,
            'Missing plan ID. Usage: projectmind plan inspect <id>'
          );
        }

        try {
          const plan = await this.service.getPlan(targetId);
          const inspectPayload = { ...plan, plan };
          if (context.format === 'json' || context.options['json']) {
            return createSuccessResult(this.name, inspectPayload);
          }

          const lines = [
            `Task Plan: ${plan.title}`,
            `  ID: ${plan.id}`,
            `  Status: ${plan.status} (v${plan.version}, Rev ${plan.planRevision})`,
            `  Objective: ${plan.objective}`,
            `  Tasks (${plan.nodes.length}):`,
          ];
          for (const n of plan.nodes) {
            lines.push(`    - [${n.status}] ${n.id}: ${n.title} (Type: ${n.taskType}, Priority: ${n.priority})`);
          }
          return createSuccessResult(this.name, inspectPayload, lines.join('\n'));
        } catch (err: any) {
          return createErrorResult(this.name, CLIExitCode.NOT_FOUND, err.message);
        }
      }

      case 'validate': {
        if (!targetId) {
          return createErrorResult(
            this.name,
            CLIExitCode.INVALID_ARGUMENT,
            'Missing plan ID. Usage: projectmind plan validate <id>'
          );
        }

        try {
          const validation = await this.service.validatePlan(targetId);
          const valPayload = { ...validation, validation };
          if (context.format === 'json' || context.options['json']) {
            return createSuccessResult(this.name, valPayload);
          }

          const lines = [
            `Plan Validation: ${validation.valid ? 'PASSED' : 'FAILED'}`,
            `  Errors: ${validation.errors.length}`,
            `  Warnings: ${validation.warnings.length}`,
            `  Conflicts: ${validation.conflicts.length}`,
          ];
          for (const err of validation.errors) {
            lines.push(`    ✗ Error: ${err}`);
          }
          for (const warn of validation.warnings) {
            lines.push(`    ⚠ Warning: ${warn}`);
          }
          return createSuccessResult(this.name, validation, lines.join('\n'));
        } catch (err: any) {
          return createErrorResult(this.name, CLIExitCode.NOT_FOUND, err.message);
        }
      }

      case 'tasks': {
        if (!targetId) {
          return createErrorResult(
            this.name,
            CLIExitCode.INVALID_ARGUMENT,
            'Missing plan ID. Usage: projectmind plan tasks <id>'
          );
        }

        try {
          const plan = await this.service.getPlan(targetId);
          if (context.format === 'json' || context.options['json']) {
            return createSuccessResult(this.name, { count: plan.nodes.length, tasks: plan.nodes });
          }

          const lines = [`Tasks in Plan '${plan.title}' (${plan.nodes.length}):`];
          for (const n of plan.nodes) {
            const deps = n.dependencies.map((d) => d.targetNodeId).join(', ') || 'none';
            lines.push(`  - [${n.status}] ${n.id} (${n.taskType}): ${n.title}`);
            lines.push(`    Deps: [${deps}] | Assignee: ${n.assignment?.agentId ?? 'unassigned'}`);
          }
          return createSuccessResult(this.name, { tasks: plan.nodes }, lines.join('\n'));
        } catch (err: any) {
          return createErrorResult(this.name, CLIExitCode.NOT_FOUND, err.message);
        }
      }

      case 'ready': {
        if (!targetId) {
          return createErrorResult(
            this.name,
            CLIExitCode.INVALID_ARGUMENT,
            'Missing plan ID. Usage: projectmind plan ready <id>'
          );
        }

        try {
          const readyTasks = await this.service.getReadyNodes(targetId);
          if (context.format === 'json' || context.options['json']) {
            return createSuccessResult(this.name, {
              count: readyTasks.length,
              readyCount: readyTasks.length,
              readyTasks,
            });
          }

          const lines = [`Ready Tasks (${readyTasks.length}):`];
          for (const n of readyTasks) {
            lines.push(`  - ${n.id}: ${n.title} [Priority: ${n.priority}, Role: ${n.preferredAgentRole}]`);
          }
          return createSuccessResult(this.name, { readyTasks }, lines.join('\n'));
        } catch (err: any) {
          return createErrorResult(this.name, CLIExitCode.NOT_FOUND, err.message);
        }
      }

      case 'blocked': {
        if (!targetId) {
          return createErrorResult(
            this.name,
            CLIExitCode.INVALID_ARGUMENT,
            'Missing plan ID. Usage: projectmind plan blocked <id>'
          );
        }

        try {
          const blockedTasks = await this.service.getBlockedNodes(targetId);
          if (context.format === 'json' || context.options['json']) {
            return createSuccessResult(this.name, {
              count: blockedTasks.length,
              blockedCount: blockedTasks.length,
              blockedTasks,
            });
          }

          const lines = [`Blocked Tasks (${blockedTasks.length}):`];
          for (const n of blockedTasks) {
            lines.push(`  - [${n.status}] ${n.id}: ${n.title}`);
          }
          return createSuccessResult(this.name, { blockedTasks }, lines.join('\n'));
        } catch (err: any) {
          return createErrorResult(this.name, CLIExitCode.NOT_FOUND, err.message);
        }
      }

      case 'start': {
        if (!targetId) {
          return createErrorResult(
            this.name,
            CLIExitCode.INVALID_ARGUMENT,
            'Missing plan ID. Usage: projectmind plan start <id>'
          );
        }

        try {
          const started = await this.service.startPlan(targetId);
          if (context.format === 'json' || context.options['json']) {
            return createSuccessResult(this.name, started);
          }
          return createSuccessResult(this.name, started, `Plan '${started.title}' started. Status: ${started.status}`);
        } catch (err: any) {
          return createErrorResult(this.name, CLIExitCode.EXECUTION_ERROR, err.message);
        }
      }

      case 'pause': {
        if (!targetId) {
          return createErrorResult(
            this.name,
            CLIExitCode.INVALID_ARGUMENT,
            'Missing plan ID. Usage: projectmind plan pause <id>'
          );
        }

        try {
          const paused = await this.service.pausePlan(targetId);
          if (context.format === 'json' || context.options['json']) {
            return createSuccessResult(this.name, paused);
          }
          return createSuccessResult(this.name, paused, `Plan '${paused.title}' paused. Status: ${paused.status}`);
        } catch (err: any) {
          return createErrorResult(this.name, CLIExitCode.EXECUTION_ERROR, err.message);
        }
      }

      case 'resume': {
        if (!targetId) {
          return createErrorResult(
            this.name,
            CLIExitCode.INVALID_ARGUMENT,
            'Missing plan ID. Usage: projectmind plan resume <id>'
          );
        }

        try {
          const resumed = await this.service.resumePlan(targetId);
          if (context.format === 'json' || context.options['json']) {
            return createSuccessResult(this.name, resumed);
          }
          return createSuccessResult(this.name, resumed, `Plan '${resumed.title}' resumed. Status: ${resumed.status}`);
        } catch (err: any) {
          return createErrorResult(this.name, CLIExitCode.EXECUTION_ERROR, err.message);
        }
      }

      case 'cancel': {
        if (!targetId) {
          return createErrorResult(
            this.name,
            CLIExitCode.INVALID_ARGUMENT,
            'Missing plan ID. Usage: projectmind plan cancel <id>'
          );
        }

        try {
          const cancelled = await this.service.cancelPlan(targetId);
          if (context.format === 'json' || context.options['json']) {
            return createSuccessResult(this.name, cancelled);
          }
          return createSuccessResult(this.name, cancelled, `Plan '${cancelled.title}' cancelled.`);
        } catch (err: any) {
          return createErrorResult(this.name, CLIExitCode.EXECUTION_ERROR, err.message);
        }
      }

      case 'advance': {
        if (!targetId) {
          return createErrorResult(
            this.name,
            CLIExitCode.INVALID_ARGUMENT,
            'Missing plan ID. Usage: projectmind plan advance <id>'
          );
        }

        try {
          const advanceRes = await this.service.advancePlan(targetId);
          if (context.format === 'json' || context.options['json']) {
            return createSuccessResult(this.name, advanceRes);
          }

          const lines = [
            `Plan Advanced: ${advanceRes.plan.title}`,
            `  Status: ${advanceRes.plan.status}`,
            `  Ready Tasks: ${advanceRes.readyNodes.length}`,
            `  Completed Tasks: ${advanceRes.completedNodeIds.length}/${advanceRes.plan.nodes.length}`,
          ];
          return createSuccessResult(this.name, advanceRes, lines.join('\n'));
        } catch (err: any) {
          return createErrorResult(this.name, CLIExitCode.EXECUTION_ERROR, err.message);
        }
      }

      case 'explain': {
        if (!targetId) {
          return createErrorResult(
            this.name,
            CLIExitCode.INVALID_ARGUMENT,
            'Missing plan ID. Usage: projectmind plan explain <id>'
          );
        }

        try {
          const explanation = await this.service.explainPlan(targetId);
          if (context.format === 'json' || context.options['json']) {
            return createSuccessResult(this.name, explanation);
          }

          const lines = [
            `Plan Explanation: ${explanation['title']}`,
            `  Status: ${explanation['status']}`,
            `  Critical Path: ${(explanation['criticalPath'] as string[]).join(' -> ') || 'none'}`,
            `  Parallel Groups: ${(explanation['parallelGroups'] as any[]).length}`,
          ];
          return createSuccessResult(this.name, explanation, lines.join('\n'));
        } catch (err: any) {
          return createErrorResult(this.name, CLIExitCode.NOT_FOUND, err.message);
        }
      }

      default:
        return createErrorResult(
          this.name,
          CLIExitCode.INVALID_ARGUMENT,
          `Unknown plan subcommand '${subcommand}'. Valid subcommands: list, create, inspect, validate, tasks, ready, blocked, start, pause, resume, cancel, advance, explain.`
        );
    }
  }
}
