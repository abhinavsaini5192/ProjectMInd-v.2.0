import { describe, it, expect, beforeEach } from 'vitest';
import { CLIApplication } from '../../src/cli/core/CLIApplication.js';
import { CLIExitCode } from '../../src/cli/core/CLIExitCode.js';
import { CommandRegistry } from '../../src/cli/core/CommandRegistry.js';
import { PlanCommand } from '../../src/cli/commands/PlanCommand.js';
import {
  TaskPlannerService,
  InMemoryTaskPlanStore,
  TaskDecomposer,
  TaskDependencyResolver,
  TaskPlanValidator,
  TaskReadinessEvaluator,
  TaskPrioritizer,
  TaskAssignmentResolver,
  ApprovalGateResolver,
  TaskCheckpointManager,
  TaskPlanRevisionManager,
  TaskOrchestrator,
  TaskPlanStatus
} from '../../src/agent/planning/index.js';

describe('Plan CLI Command Suite (Phase 9.6 Section 29)', () => {
  let store: InMemoryTaskPlanStore;
  let plannerService: TaskPlannerService;
  let command: PlanCommand;
  let app: CLIApplication;
  let stdoutLogs: string[];
  let stderrLogs: string[];

  beforeEach(() => {
    stdoutLogs = [];
    stderrLogs = [];

    store = new InMemoryTaskPlanStore();
    const decomposer = new TaskDecomposer();
    const dependencyResolver = new TaskDependencyResolver();
    const validator = new TaskPlanValidator(store);
    const readinessEvaluator = new TaskReadinessEvaluator();
    const prioritizer = new TaskPrioritizer(dependencyResolver);
    const assignmentResolver = new TaskAssignmentResolver();
    const approvalResolver = new ApprovalGateResolver();
    const checkpointManager = new TaskCheckpointManager(store);
    const revisionManager = new TaskPlanRevisionManager(store);

    const orchestrator = new TaskOrchestrator(
      store,
      validator,
      dependencyResolver,
      readinessEvaluator,
      assignmentResolver,
      approvalResolver
    );

    plannerService = new TaskPlannerService(
      store,
      decomposer,
      validator,
      dependencyResolver,
      readinessEvaluator,
      prioritizer,
      approvalResolver,
      orchestrator,
      checkpointManager,
      revisionManager
    );

    command = new PlanCommand(plannerService);
    const registry = new CommandRegistry();
    registry.register(command);

    app = new CLIApplication({
      registry,
      stdout: (msg) => stdoutLogs.push(msg),
      stderr: (msg) => stderrLogs.push(msg),
    });
  });

  it('plan list should list plans with --json flag', async () => {
    const exitCode = await app.run(['plan', 'list', '--json']);
    expect(exitCode).toBe(CLIExitCode.SUCCESS);
    const json = JSON.parse(stdoutLogs.join('\n'));
    expect(json.data.plans).toEqual([]);
    expect(json.data.total).toBe(0);
  });

  it('plan create should create a new plan and output json', async () => {
    const exitCode = await app.run([
      'plan',
      'create',
      '--title',
      'Implement OAuth',
      '--objective',
      'Add authentication with Google OAuth',
      '--workspace',
      'ws_cli',
      '--project',
      'proj_cli',
      '--json'
    ]);

    expect(exitCode).toBe(CLIExitCode.SUCCESS);
    const json = JSON.parse(stdoutLogs.join('\n'));
    expect(json.data.planId).toBeDefined();
    expect(json.data.title).toBe('Implement OAuth');
    expect(json.data.taskCount).toBeGreaterThan(0);
  });

  it('plan inspect should show plan details', async () => {
    const plan = await plannerService.createPlan({
      workspaceId: 'ws_cli',
      projectId: 'proj_cli',
      title: 'Inspectable Plan',
      objective: 'Inspect this plan',
      createdBy: 'user_cli',
    });

    const exitCode = await app.run(['plan', 'inspect', plan.id, '--json']);
    expect(exitCode).toBe(CLIExitCode.SUCCESS);
    const json = JSON.parse(stdoutLogs.join('\n'));
    expect(json.data.plan.id).toBe(plan.id);
  });

  it('plan validate should validate plan structure', async () => {
    const plan = await plannerService.createPlan({
      workspaceId: 'ws_cli',
      projectId: 'proj_cli',
      title: 'Validatable Plan',
      objective: 'Validate this plan',
      createdBy: 'user_cli',
    });

    const exitCode = await app.run(['plan', 'validate', plan.id, '--json']);
    expect(exitCode).toBe(CLIExitCode.SUCCESS);
    const json = JSON.parse(stdoutLogs.join('\n'));
    expect(json.data.validation.valid).toBe(true);
  });

  it('plan ready and plan blocked should show partitioned tasks', async () => {
    const plan = await plannerService.createPlan({
      workspaceId: 'ws_cli',
      projectId: 'proj_cli',
      title: 'Partition Plan',
      objective: 'Partition tasks',
      createdBy: 'user_cli',
    });

    const exitReady = await app.run(['plan', 'ready', plan.id, '--json']);
    expect(exitReady).toBe(CLIExitCode.SUCCESS);
    const readyJson = JSON.parse(stdoutLogs.join('\n'));
    expect(readyJson.data.readyCount).toBeGreaterThanOrEqual(1);

    stdoutLogs.length = 0;

    const exitBlocked = await app.run(['plan', 'blocked', plan.id, '--json']);
    expect(exitBlocked).toBe(CLIExitCode.SUCCESS);
    const blockedJson = JSON.parse(stdoutLogs.join('\n'));
    expect(blockedJson.data.blockedCount).toBeGreaterThanOrEqual(1);
  });

  it('plan start, pause, resume, and advance should execute lifecycle commands', async () => {
    const plan = await plannerService.createPlan({
      workspaceId: 'ws_cli',
      projectId: 'proj_cli',
      title: 'Lifecycle CLI Plan',
      objective: 'Test lifecycle commands',
      createdBy: 'user_cli',
    });

    // Start
    let exitCode = await app.run(['plan', 'start', plan.id, '--json']);
    expect(exitCode).toBe(CLIExitCode.SUCCESS);

    stdoutLogs.length = 0;

    // Advance
    exitCode = await app.run(['plan', 'advance', plan.id, '--json']);
    expect(exitCode).toBe(CLIExitCode.SUCCESS);
    let json = JSON.parse(stdoutLogs.join('\n'));
    expect(json.data.tasksStarted.length).toBeGreaterThanOrEqual(1);

    stdoutLogs.length = 0;

    // Pause
    exitCode = await app.run(['plan', 'pause', plan.id, '--reason', 'User pause', '--json']);
    expect(exitCode).toBe(CLIExitCode.SUCCESS);

    stdoutLogs.length = 0;

    // Resume
    exitCode = await app.run(['plan', 'resume', plan.id, '--json']);
    expect(exitCode).toBe(CLIExitCode.SUCCESS);
  });

  it('plan explain should return planning explanation', async () => {
    const plan = await plannerService.createPlan({
      workspaceId: 'ws_cli',
      projectId: 'proj_cli',
      title: 'Explainable CLI Plan',
      objective: 'Explain planning choices',
      createdBy: 'user_cli',
    });

    const exitCode = await app.run(['plan', 'explain', plan.id, '--json']);
    expect(exitCode).toBe(CLIExitCode.SUCCESS);
    const json = JSON.parse(stdoutLogs.join('\n'));
    expect(json.data.planId).toBe(plan.id);
    expect(json.data.summary).toContain('Explainable CLI Plan');
  });
});
