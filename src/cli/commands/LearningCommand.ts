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

export class LearningCommand implements CLICommand {
  public readonly name = 'learning';
  public readonly description = 'Inspect, evaluate, and manage learning candidates and deployed adaptations (Phase 9.7)';
  public readonly aliases: readonly string[] = ['learn'];

  public readonly help: CLICommandHelp = {
    summary: 'Manage learning candidates, evaluations, deployments, and rollbacks.',
    usage: 'projectmind learning <subcommand> [args] [options]',
    examples: [
      'projectmind learning list',
      'projectmind learning candidates',
      'projectmind learning evaluate cand_12345',
      'projectmind learning approve cand_12345',
      'projectmind learning deploy cand_12345',
      'projectmind learning rollback dep_12345 --reason "Regression in latency"',
      'projectmind learning explain cand_12345',
      'projectmind learning conflicts',
    ],
    subcommands: [
      { name: 'list', description: 'List active deployed learning adaptations' },
      { name: 'candidates', description: 'List generated learning candidates' },
      { name: 'inspect', description: 'Inspect candidate or deployed learning details' },
      { name: 'evaluate', description: 'Run quality evaluation on a candidate' },
      { name: 'approve', description: 'Explicitly approve a candidate for deployment' },
      { name: 'reject', description: 'Reject a candidate' },
      { name: 'deploy', description: 'Deploy an accepted learning candidate' },
      { name: 'disable', description: 'Disable an active deployed learning' },
      { name: 'rollback', description: 'Rollback a deployed learning' },
      { name: 'explain', description: 'Explain the reasoning and evidence for a learning artifact' },
      { name: 'conflicts', description: 'List detected conflicting feedback records' },
    ],
    options: [
      { name: 'reason', description: 'Justification for rejection or rollback', type: 'string' },
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
      case 'list': {
        const learnings = await this.service.getDeployedLearnings({
          workspaceId,
          status: ['ACTIVE'],
        });

        if (isJson) {
          return createSuccessResult(this.name, { count: learnings.length, learnings });
        }

        const lines = [`\x1b[1;36mActive Deployed Learnings (${learnings.length}):\x1b[0m`, ''];
        if (learnings.length === 0) {
          lines.push('  No active deployed learnings found.');
        } else {
          for (const l of learnings) {
            lines.push(
              `  \x1b[1m[${l.target.system}]\x1b[0m \x1b[32m${l.target.targetId}\x1b[0m (ID: ${l.id}, v${l.version})`
            );
            lines.push(`    Scope: ${l.scope.level} | DeployedBy: ${l.deployedBy}`);
            lines.push(`    Effect: ${l.metadata?.['expectedEffect'] ?? JSON.stringify(l.appliedChange)}`);
            lines.push('');
          }
        }
        return createSuccessResult(this.name, { count: learnings.length, learnings }, lines.join('\n'));
      }

      case 'candidates': {
        const candidates = await this.service.getCandidates({
          workspaceId,
        });

        if (isJson) {
          return createSuccessResult(this.name, { count: candidates.length, candidates });
        }

        const lines = [`\x1b[1;36mLearning Candidates (${candidates.length}):\x1b[0m`, ''];
        if (candidates.length === 0) {
          lines.push('  No learning candidates found.');
        } else {
          for (const c of candidates) {
            lines.push(
              `  \x1b[1m[${c.target.system}:${c.candidateType}]\x1b[0m ${c.target.targetId} (ID: ${c.id})`
            );
            lines.push(
              `    Status: \x1b[33m${c.evaluationStatus}\x1b[0m | Confidence: ${Math.round(c.confidence * 100)}% | Risk: ${c.risk}`
            );
            lines.push(`    Effect: ${c.expectedEffect}`);
            lines.push('');
          }
        }
        return createSuccessResult(this.name, { count: candidates.length, candidates }, lines.join('\n'));
      }

      case 'inspect': {
        const id = context.args[1];
        if (!id) {
          return createErrorResult(this.name, CLIExitCode.INVALID_ARGUMENT, 'Missing ID: projectmind learning inspect <id>');
        }

        const candidate = await this.service.getCandidate(id);
        if (candidate) {
          if (isJson) return createSuccessResult(this.name, candidate);
          const lines = [
            `\x1b[1;36mLearning Candidate Details (${candidate.id}):\x1b[0m`,
            `  Type:        ${candidate.candidateType}`,
            `  System:      ${candidate.target.system}`,
            `  Target:      ${candidate.target.targetId}`,
            `  Status:      ${candidate.evaluationStatus}`,
            `  Mode:        ${candidate.deploymentMode}`,
            `  Confidence:  ${Math.round(candidate.confidence * 100)}%`,
            `  Risk:        ${candidate.risk}`,
            `  Scope:       ${candidate.scope.level}`,
            `  Effect:      ${candidate.expectedEffect}`,
            `  Evidence:    ${candidate.evidence.length} items`,
          ];
          return createSuccessResult(this.name, candidate, lines.join('\n'));
        }

        const deployed = (await this.service.getDeployedLearnings({ workspaceId })).find((d) => d.id === id);
        if (deployed) {
          if (isJson) return createSuccessResult(this.name, deployed);
          const lines = [
            `\x1b[1;36mDeployed Learning Details (${deployed.id}):\x1b[0m`,
            `  Target:      ${deployed.target.system}:${deployed.target.targetId}`,
            `  Version:     ${deployed.version}`,
            `  Status:      ${deployed.status}`,
            `  Deployed By: ${deployed.deployedBy}`,
            `  Deployed At: ${new Date(deployed.deployedAt).toISOString()}`,
            `  Scope:       ${deployed.scope.level}`,
            `  Changes:     ${JSON.stringify(deployed.appliedChange, null, 2)}`,
          ];
          return createSuccessResult(this.name, deployed, lines.join('\n'));
        }

        return createErrorResult(this.name, CLIExitCode.NOT_FOUND, `Learning artifact '${id}' not found.`);
      }

      case 'evaluate': {
        const id = context.args[1];
        if (!id) {
          return createErrorResult(this.name, CLIExitCode.INVALID_ARGUMENT, 'Missing candidate ID: projectmind learning evaluate <candidateId>');
        }

        try {
          const evalResult = await this.service.evaluateCandidate(id, { evaluatorId: 'cli-user' });
          if (isJson) return createSuccessResult(this.name, evalResult);

          const lines = [
            `\x1b[1;32mEvaluation Completed:\x1b[0m`,
            `  Candidate ID:       ${evalResult.candidateId}`,
            `  Overall Score:      ${evalResult.overallScore.toFixed(2)}`,
            `  Accepted:           ${evalResult.isAccepted ? 'YES' : 'NO'}`,
            `  Recommended Action: ${evalResult.recommendedAction}`,
            `  Explanation:        ${evalResult.explanation}`,
          ];
          return createSuccessResult(this.name, evalResult, lines.join('\n'));
        } catch (err: any) {
          return createErrorResult(this.name, CLIExitCode.EXECUTION_ERROR, `Evaluation failed: ${err.message}`);
        }
      }

      case 'approve': {
        const id = context.args[1];
        if (!id) {
          return createErrorResult(this.name, CLIExitCode.INVALID_ARGUMENT, 'Missing candidate ID: projectmind learning approve <candidateId>');
        }

        try {
          const approved = await this.service.approveCandidate(id, 'cli-operator');
          if (isJson) return createSuccessResult(this.name, approved);

          return createSuccessResult(
            this.name,
            approved,
            `\x1b[1;32mCandidate "${id}" approved for deployment.\x1b[0m`
          );
        } catch (err: any) {
          return createErrorResult(this.name, CLIExitCode.EXECUTION_ERROR, `Approval failed: ${err.message}`);
        }
      }

      case 'reject': {
        const id = context.args[1];
        if (!id) {
          return createErrorResult(this.name, CLIExitCode.INVALID_ARGUMENT, 'Missing candidate ID: projectmind learning reject <candidateId>');
        }
        const reason = (context.getOption('reason') as string) ?? 'Rejected via CLI';

        try {
          const rejected = await this.service.rejectCandidate(id, reason, 'cli-operator');
          if (isJson) return createSuccessResult(this.name, rejected);

          return createSuccessResult(
            this.name,
            rejected,
            `\x1b[1;33mCandidate "${id}" rejected.\x1b[0m`
          );
        } catch (err: any) {
          return createErrorResult(this.name, CLIExitCode.EXECUTION_ERROR, `Rejection failed: ${err.message}`);
        }
      }

      case 'deploy': {
        const id = context.args[1];
        if (!id) {
          return createErrorResult(this.name, CLIExitCode.INVALID_ARGUMENT, 'Missing candidate ID: projectmind learning deploy <candidateId>');
        }

        try {
          const deployed = await this.service.deployCandidate(id, 'cli-operator');
          if (isJson) return createSuccessResult(this.name, deployed);

          const lines = [
            `\x1b[1;32mLearning Adaptation Deployed Successfully:\x1b[0m`,
            `  Deployed ID: ${deployed.id}`,
            `  Version:     ${deployed.version}`,
            `  Target:      ${deployed.target.system}:${deployed.target.targetId}`,
            `  Scope:       ${deployed.scope.level}`,
          ];
          return createSuccessResult(this.name, deployed, lines.join('\n'));
        } catch (err: any) {
          return createErrorResult(this.name, CLIExitCode.EXECUTION_ERROR, `Deployment failed: ${err.message}`);
        }
      }

      case 'disable': {
        const id = context.args[1];
        if (!id) {
          return createErrorResult(this.name, CLIExitCode.INVALID_ARGUMENT, 'Missing deployed learning ID: projectmind learning disable <id>');
        }

        try {
          const disabled = await this.service.disableLearning(id, 'cli-operator');
          if (isJson) return createSuccessResult(this.name, disabled);

          return createSuccessResult(
            this.name,
            disabled,
            `\x1b[1;33mDeployed learning "${id}" disabled.\x1b[0m`
          );
        } catch (err: any) {
          return createErrorResult(this.name, CLIExitCode.EXECUTION_ERROR, `Disable failed: ${err.message}`);
        }
      }

      case 'rollback': {
        const id = context.args[1];
        if (!id) {
          return createErrorResult(this.name, CLIExitCode.INVALID_ARGUMENT, 'Missing deployed learning ID: projectmind learning rollback <id>');
        }
        const reason = (context.getOption('reason') as string) ?? 'Manual rollback via CLI';

        try {
          const rollback = await this.service.rollbackLearning(id, reason, 'cli-operator');
          if (isJson) return createSuccessResult(this.name, rollback);

          const lines = [
            `\x1b[1;32mLearning Adaptation Rolled Back Successfully:\x1b[0m`,
            `  Rollback ID: ${rollback.id}`,
            `  Target ID:   ${rollback.deployedLearningId}`,
            `  Reason:      ${rollback.reason}`,
            `  Audit:       ${rollback.auditNote}`,
          ];
          return createSuccessResult(this.name, rollback, lines.join('\n'));
        } catch (err: any) {
          return createErrorResult(this.name, CLIExitCode.EXECUTION_ERROR, `Rollback failed: ${err.message}`);
        }
      }

      case 'explain': {
        const id = context.args[1];
        if (!id) {
          return createErrorResult(this.name, CLIExitCode.INVALID_ARGUMENT, 'Missing ID to explain: projectmind learning explain <id>');
        }

        try {
          const exp = await this.service.explainLearning(id);
          if (isJson) return createSuccessResult(this.name, exp);

          const lines = [
            `\x1b[1;36mStructured Learning Explanation (${exp.id}):\x1b[0m`,
            `  Type:               ${exp.type}`,
            `  Target System:      ${exp.targetSystem}`,
            `  Target ID:          ${exp.targetId}`,
            `  Scope:              ${exp.scope}`,
            `  Confidence:         ${Math.round(exp.confidence * 100)}%`,
            `  Authority:          ${exp.authority}`,
            `  Status:             ${exp.status}`,
            `  Reversibility:      ${exp.reversibility}`,
            `  Supporting Evidence Count: ${exp.supportingEvidenceCount}`,
            `  Primary Reasons:`,
            ...exp.primaryReasons.map((r) => `    - ${r}`),
          ];
          if (exp.conflictingEvidence.length > 0) {
            lines.push(`  Conflicting Evidence:`);
            exp.conflictingEvidence.forEach((c) => lines.push(`    - ${c}`));
          }
          if (exp.potentialRisks.length > 0) {
            lines.push(`  Potential Risks:`);
            exp.potentialRisks.forEach((r) => lines.push(`    - ${r}`));
          }
          return createSuccessResult(this.name, exp, lines.join('\n'));
        } catch (err: any) {
          return createErrorResult(this.name, CLIExitCode.NOT_FOUND, `Explanation failed: ${err.message}`);
        }
      }

      case 'conflicts': {
        const conflicts = await this.service.getConflicts(workspaceId);
        if (isJson) return createSuccessResult(this.name, { count: conflicts.length, conflicts });

        const lines = [`\x1b[1;36mDetected Learning Conflicts (${conflicts.length}):\x1b[0m`, ''];
        if (conflicts.length === 0) {
          lines.push('  No conflicting feedback detected.');
        } else {
          for (const c of conflicts) {
            lines.push(`  \x1b[1mTarget: ${c.targetType}:${c.targetId}\x1b[0m (ID: ${c.id})`);
            lines.push(`    Claim A: ${c.claimA}`);
            lines.push(`    Claim B: ${c.claimB}`);
            lines.push(`    Resolution: ${c.resolution ?? 'Context-scoped resolution'}`);
            lines.push('');
          }
        }
        return createSuccessResult(this.name, { count: conflicts.length, conflicts }, lines.join('\n'));
      }

      default:
        return createErrorResult(this.name, CLIExitCode.INVALID_ARGUMENT, `Unknown subcommand '${subcommand}'.`);
    }
  }
}
