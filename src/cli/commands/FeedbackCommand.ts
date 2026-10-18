import type { CLICommand, CLICommandHelp } from '../core/CLICommand.js';
import type { CLIContext } from '../core/CLIContext.js';
import { type CLIResult, createSuccessResult, createErrorResult } from '../core/CLIResult.js';
import { CLIExitCode } from '../core/CLIExitCode.js';
import type { ILearningIntelligenceService } from '../../intelligence/learning/interfaces/ILearningIntelligenceService.js';
import { InMemoryFeedbackStore } from '../../intelligence/learning/services/InMemoryFeedbackStore.js';
import { InMemoryLearningStore } from '../../intelligence/learning/services/InMemoryLearningStore.js';
import { FeedbackNormalizer } from '../../intelligence/learning/services/FeedbackNormalizer.js';
import { FeedbackCollector } from '../../intelligence/learning/services/FeedbackCollector.js';
import { LearningSignalExtractor } from '../../intelligence/learning/services/LearningSignalExtractor.js';
import { LearningCandidateGenerator } from '../../intelligence/learning/services/LearningCandidateGenerator.js';
import { LearningEvaluator } from '../../intelligence/learning/services/LearningEvaluator.js';
import { LearningPolicyEngine } from '../../intelligence/learning/services/LearningPolicyEngine.js';
import { LearningDeploymentManager } from '../../intelligence/learning/services/LearningDeploymentManager.js';
import { LearningRollbackManager } from '../../intelligence/learning/services/LearningRollbackManager.js';
import { LearningIntelligenceService } from '../../intelligence/learning/services/LearningIntelligenceService.js';

export class FeedbackCommand implements CLICommand {
  public readonly name = 'feedback';
  public readonly description = 'Collect and inspect validated feedback for learning intelligence (Phase 9.7)';
  public readonly aliases: readonly string[] = ['fb'];

  public readonly help: CLICommandHelp = {
    summary: 'Submit and inspect feedback records across context, retrieval, planning, and verification.',
    usage: 'projectmind feedback <subcommand> [args] [options]',
    examples: [
      'projectmind feedback submit --type CONTEXT_USEFUL --target RESOURCE:src/auth.ts',
      'projectmind feedback list',
      'projectmind feedback inspect fb_12345',
    ],
    subcommands: [
      { name: 'submit', description: 'Submit a feedback record' },
      { name: 'list', description: 'List recent recorded feedback' },
      { name: 'inspect', description: 'Inspect details of a specific feedback record' },
    ],
    options: [
      { name: 'type', description: 'Feedback type (e.g. CONTEXT_USEFUL, RETRIEVAL_RELEVANT)', type: 'string' },
      { name: 'target', description: 'Target in format TYPE:ID (e.g. RESOURCE:src/auth.ts)', type: 'string' },
      { name: 'source', description: 'Source type (USER, AGENT, VERIFICATION, etc.)', type: 'string' },
      { name: 'value', description: 'Normalized numeric feedback score (-1.0 to 1.0)', type: 'number' },
      { name: 'json', description: 'Output results in JSON format', type: 'boolean' },
    ],
  };

  private readonly service: ILearningIntelligenceService;

  constructor(service?: ILearningIntelligenceService | undefined) {
    if (service) {
      this.service = service;
    } else {
      const fbStore = new InMemoryFeedbackStore();
      const lStore = new InMemoryLearningStore();
      const norm = new FeedbackNormalizer();
      const col = new FeedbackCollector(fbStore, norm);
      const sigExt = new LearningSignalExtractor(lStore);
      const candGen = new LearningCandidateGenerator(lStore);
      const evalService = new LearningEvaluator(lStore);
      const pol = new LearningPolicyEngine();
      const dep = new LearningDeploymentManager(lStore, pol);
      const rb = new LearningRollbackManager(lStore);
      this.service = new LearningIntelligenceService(
        fbStore,
        lStore,
        col,
        sigExt,
        candGen,
        evalService,
        pol,
        dep,
        rb
      );
    }
  }

  public async execute(context: CLIContext): Promise<CLIResult> {
    const subcommand = context.args[0] ?? 'list';
    const isJson = context.format === 'json' || Boolean(context.getOption('json'));
    const workspaceId = (context.getOption('workspace') as string) ?? context.workspacePath ?? 'default-ws';

    switch (subcommand) {
      case 'submit': {
        const feedbackType = (context.getOption('type') as string) ?? 'CONTEXT_USEFUL';
        const targetRaw = (context.getOption('target') as string) ?? 'RESOURCE:default';
        const [targetType = 'RESOURCE', targetId = 'default'] = targetRaw.split(':');
        const sourceType = ((context.getOption('source') as string) ?? 'USER') as any;
        const val = context.getOption('value');
        const numVal = typeof val === 'number' ? val : typeof val === 'string' ? parseFloat(val) : 1.0;

        const record = await this.service.submitFeedback({
          workspaceId,
          projectId: 'default-proj',
          sourceType,
          sourceId: 'cli-user',
          feedbackType: feedbackType as any,
          targetType,
          targetId,
          value: numVal,
          provenance: {
            origin: 'cli',
            isExplicit: true,
          },
        });

        if (isJson) {
          return createSuccessResult(this.name, record);
        }

        const lines = [
          `\x1b[1;32mFeedback recorded successfully:\x1b[0m`,
          `  ID:        ${record.id}`,
          `  Type:      ${record.feedbackType}`,
          `  Target:    ${record.targetType}:${record.targetId}`,
          `  Signal:    ${record.signal} (${record.value.toFixed(2)})`,
          `  Authority: ${record.provenance.authority}`,
        ];
        return createSuccessResult(this.name, record, lines.join('\n'));
      }

      case 'inspect': {
        const id = context.args[1];
        if (!id) {
          return createErrorResult(this.name, CLIExitCode.INVALID_ARGUMENT, 'Missing feedback ID: projectmind feedback inspect <id>');
        }

        const fb = await this.service.getFeedback(id);
        if (!fb) {
          return createErrorResult(this.name, CLIExitCode.NOT_FOUND, `Feedback record '${id}' not found.`);
        }

        if (isJson) {
          return createSuccessResult(this.name, fb);
        }

        const lines = [
          `\x1b[1;36mFeedback Details (${fb.id}):\x1b[0m`,
          `  Source:     ${fb.sourceType} (${fb.sourceId})`,
          `  Type:       ${fb.feedbackType}`,
          `  Target:     ${fb.targetType}:${fb.targetId}`,
          `  Signal:     ${fb.signal} (Score: ${fb.value.toFixed(2)})`,
          `  Confidence: ${Math.round(fb.confidence * 100)}%`,
          `  Authority:  ${fb.provenance.authority}`,
          `  Scope:      ${fb.scope.level}:${fb.scope.value}`,
          `  Timestamp:  ${new Date(fb.timestamp).toISOString()}`,
        ];
        return createSuccessResult(this.name, fb, lines.join('\n'));
      }

      case 'list':
      default: {
        const items = await this.service.queryFeedback({
          workspaceId,
          limit: 20,
        });

        if (isJson) {
          return createSuccessResult(this.name, { count: items.length, items });
        }

        const lines = [`\x1b[1;36mRecorded Feedback (${items.length}):\x1b[0m`, ''];
        if (items.length === 0) {
          lines.push('  No feedback records found.');
        } else {
          for (const item of items) {
            lines.push(
              `  \x1b[1m[${item.feedbackType}]\x1b[0m ${item.targetType}:${item.targetId} (Signal: ${item.signal}, Score: ${item.value.toFixed(2)})`
            );
            lines.push(`    ID: ${item.id} | Auth: ${item.provenance.authority} | Scope: ${item.scope.level}`);
          }
        }
        return createSuccessResult(this.name, { count: items.length, items }, lines.join('\n'));
      }
    }
  }
}
