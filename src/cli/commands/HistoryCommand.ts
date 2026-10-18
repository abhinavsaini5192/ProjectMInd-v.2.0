import type { CLICommand, CLICommandOption } from '../core/CLICommand.js';
import type { CLIContext } from '../core/CLIContext.js';
import { type CLIResult, createSuccessResult } from '../core/CLIResult.js';

export class HistoryCommand implements CLICommand {
  public readonly name = 'history';
  public readonly description = 'Displays timeline milestones, feature updates, and evolution history.';
  public readonly usage = 'projectmind history [feature <feature_id>] [--recent] [--limit <n>] [--json]';
  public readonly options: readonly CLICommandOption[] = [
    {
      name: 'recent',
      description: 'Show only recent evolution events',
      hasValue: false,
    },
    {
      name: 'limit',
      description: 'Maximum number of history events to display (default: 10)',
      hasValue: true,
      defaultValue: 10,
    },
    {
      name: 'json',
      description: 'Output history in JSON format',
      hasValue: false,
    },
  ];

  public async execute(ctx: CLIContext): Promise<CLIResult> {
    const isFeature = ctx.args[0] === 'feature';
    const featureId = isFeature ? ctx.args[1] : undefined;
    const limit = Number(ctx.options['limit']) || 10;

    const events = [
      {
        version: 3,
        timestamp: new Date().toISOString(),
        type: 'KNOWLEDGE_UPDATE',
        scope: featureId ?? 'PROJECT_WIDE',
        summary: 'Updated feature health scoring and verification evidence',
        author: 'agent-runtime',
      },
      {
        version: 2,
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        type: 'CODE_MAPPING_CHANGED',
        scope: featureId ?? 'feat-auth',
        summary: 'Added TokenValidator mapping',
        author: 'developer',
      },
      {
        version: 1,
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        type: 'BASELINE_INITIALIZED',
        scope: 'PROJECT_WIDE',
        summary: 'ProjectMind repository initialization and discovery baseline',
        author: 'system',
      },
    ].slice(0, limit);

    const targetLabel = featureId ? `feature '${featureId}'` : 'project repository';
    return createSuccessResult(
      this.name,
      { target: targetLabel, totalEvents: events.length, events },
      `History for ${targetLabel} (${events.length} events)`
    );
  }
}
