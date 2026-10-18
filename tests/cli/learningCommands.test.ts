import { describe, it, expect, beforeEach } from 'vitest';
import { CLIApplication } from '../../src/cli/core/CLIApplication.js';
import { CLIExitCode } from '../../src/cli/core/CLIExitCode.js';
import { CommandRegistry } from '../../src/cli/core/CommandRegistry.js';
import { FeedbackCommand } from '../../src/cli/commands/FeedbackCommand.js';
import { LearningCommand } from '../../src/cli/commands/LearningCommand.js';
import { InMemoryFeedbackStore } from '../../src/intelligence/learning/services/InMemoryFeedbackStore.js';
import { InMemoryLearningStore } from '../../src/intelligence/learning/services/InMemoryLearningStore.js';
import { FeedbackNormalizer } from '../../src/intelligence/learning/services/FeedbackNormalizer.js';
import { FeedbackCollector } from '../../src/intelligence/learning/services/FeedbackCollector.js';
import { LearningSignalExtractor } from '../../src/intelligence/learning/services/LearningSignalExtractor.js';
import { LearningCandidateGenerator } from '../../src/intelligence/learning/services/LearningCandidateGenerator.js';
import { LearningEvaluator } from '../../src/intelligence/learning/services/LearningEvaluator.js';
import { LearningPolicyEngine } from '../../src/intelligence/learning/services/LearningPolicyEngine.js';
import { LearningDeploymentManager } from '../../src/intelligence/learning/services/LearningDeploymentManager.js';
import { LearningRollbackManager } from '../../src/intelligence/learning/services/LearningRollbackManager.js';
import { LearningIntelligenceService } from '../../src/intelligence/learning/services/LearningIntelligenceService.js';

describe('Feedback & Learning CLI Commands (Phase 9.7 Section 33)', () => {
  let app: CLIApplication;
  let service: LearningIntelligenceService;
  let stdoutLogs: string[];
  let stderrLogs: string[];
  const testWorkspace = 'test-ws-cli';

  beforeEach(() => {
    stdoutLogs = [];
    stderrLogs = [];

    const fbStore = new InMemoryFeedbackStore();
    const lStore = new InMemoryLearningStore();
    const normalizer = new FeedbackNormalizer();
    const collector = new FeedbackCollector(fbStore, normalizer);
    const signalExtractor = new LearningSignalExtractor(lStore);
    const candidateGenerator = new LearningCandidateGenerator(lStore);
    const evaluator = new LearningEvaluator(lStore);
    const policyEngine = new LearningPolicyEngine();
    const deploymentManager = new LearningDeploymentManager(lStore, policyEngine);
    const rollbackManager = new LearningRollbackManager(lStore);

    service = new LearningIntelligenceService(
      fbStore,
      lStore,
      collector,
      signalExtractor,
      candidateGenerator,
      evaluator,
      policyEngine,
      deploymentManager,
      rollbackManager
    );

    const registry = new CommandRegistry();
    registry.register(new FeedbackCommand(service));
    registry.register(new LearningCommand(service));

    app = new CLIApplication({
      registry,
      stdout: (msg) => stdoutLogs.push(msg),
      stderr: (msg) => stderrLogs.push(msg),
    });
  });

  it('projectmind feedback submit should record feedback with --json', async () => {
    const exitCode = await app.run([
      'feedback',
      'submit',
      '--type',
      'CONTEXT_USEFUL',
      '--target',
      'RESOURCE:src/auth.ts',
      '--value',
      '1.0',
      '--workspace',
      testWorkspace,
      '--json',
    ]);

    expect(exitCode).toBe(CLIExitCode.SUCCESS);
    const json = JSON.parse(stdoutLogs.join('\n'));
    expect(json.data.id).toBeDefined();
    expect(json.data.feedbackType).toBe('CONTEXT_USEFUL');
  });

  it('projectmind feedback list should list recorded items', async () => {
    await service.submitFeedback({
      workspaceId: testWorkspace,
      projectId: 'proj_1',
      sourceType: 'USER',
      sourceId: 'user_1',
      feedbackType: 'CONTEXT_USEFUL',
      targetType: 'RESOURCE',
      targetId: 'src/main.ts',
    });

    const exitCode = await app.run(['feedback', 'list', '--workspace', testWorkspace, '--json']);
    expect(exitCode).toBe(CLIExitCode.SUCCESS);
    const json = JSON.parse(stdoutLogs.join('\n'));
    expect(json.data.count).toBe(1);
  });

  it('projectmind learning candidates and evaluate should work via CLI', async () => {
    // Record feedback and generate candidate
    await service.submitFeedback({
      workspaceId: testWorkspace,
      projectId: 'proj_1',
      sourceType: 'USER',
      sourceId: 'user_1',
      feedbackType: 'CONTEXT_USEFUL',
      targetType: 'RESOURCE',
      targetId: 'src/auth.ts',
      value: 1.0,
    });
    await service.generateSignals(testWorkspace, 'proj_1');
    const candidates = await service.generateCandidates(testWorkspace, 'proj_1');
    const candId = candidates[0]!.id;

    // List candidates
    stdoutLogs = [];
    const listExit = await app.run(['learning', 'candidates', '--workspace', testWorkspace, '--json']);
    expect(listExit).toBe(CLIExitCode.SUCCESS);
    const listJson = JSON.parse(stdoutLogs.join('\n'));
    expect(listJson.data.count).toBe(1);

    // Evaluate candidate
    stdoutLogs = [];
    const evalExit = await app.run(['learning', 'evaluate', candId, '--json']);
    expect(evalExit).toBe(CLIExitCode.SUCCESS);
    const evalJson = JSON.parse(stdoutLogs.join('\n'));
    expect(evalJson.data.overallScore).toBeGreaterThan(0);
  });

  it('projectmind learning deploy and rollback should execute cleanly', async () => {
    for (let i = 1; i <= 3; i++) {
      await service.submitFeedback({
        workspaceId: testWorkspace,
        projectId: 'proj_1',
        sourceType: i === 1 ? 'USER' : i === 2 ? 'VERIFICATION' : 'AGENT',
        sourceId: `source_${i}`,
        feedbackType: 'CONTEXT_USEFUL',
        targetType: 'RESOURCE',
        targetId: 'src/auth/jwt.ts',
        value: 1.0,
      });
    }
    await service.generateSignals(testWorkspace, 'proj_1');
    const candidates = await service.generateCandidates(testWorkspace, 'proj_1');
    const candId = candidates[0]!.id;

    // Deploy
    stdoutLogs = [];
    const depExit = await app.run(['learning', 'deploy', candId, '--json']);
    expect(depExit).toBe(CLIExitCode.SUCCESS);
    const depJson = JSON.parse(stdoutLogs.join('\n'));
    expect(depJson.data.status).toBe('ACTIVE');
    const deployedId = depJson.data.id;

    // Rollback
    stdoutLogs = [];
    const rbExit = await app.run([
      'learning',
      'rollback',
      deployedId,
      '--reason',
      'Caused unexpected latency regression',
      '--json',
    ]);
    if (rbExit !== CLIExitCode.SUCCESS) {
      console.error('Rollback failed:', stderrLogs, stdoutLogs);
    }
    expect(rbExit).toBe(CLIExitCode.SUCCESS);
    const rbJson = JSON.parse(stdoutLogs.join('\n'));
    expect(rbJson.data.reason).toBe('Caused unexpected latency regression');
  });

  it('projectmind learning explain should provide structured explanation', async () => {
    await service.submitFeedback({
      workspaceId: testWorkspace,
      projectId: 'proj_1',
      sourceType: 'USER',
      sourceId: 'user_1',
      feedbackType: 'CONTEXT_USEFUL',
      targetType: 'RESOURCE',
      targetId: 'src/auth.ts',
      value: 1.0,
    });
    await service.generateSignals(testWorkspace, 'proj_1');
    const candidates = await service.generateCandidates(testWorkspace, 'proj_1');
    const candId = candidates[0]!.id;

    stdoutLogs = [];
    const expExit = await app.run(['learning', 'explain', candId, '--json']);
    expect(expExit).toBe(CLIExitCode.SUCCESS);
    const expJson = JSON.parse(stdoutLogs.join('\n'));
    expect(expJson.data.id).toBe(candId);
    expect(expJson.data.primaryReasons.length).toBeGreaterThan(0);
  });
});
