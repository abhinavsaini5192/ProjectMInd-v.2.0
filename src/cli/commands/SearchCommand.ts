import type { CLICommand, CLICommandHelp } from '../core/CLICommand.js';
import type { CLIContext } from '../core/CLIContext.js';
import { type CLIResult, createSuccessResult, createErrorResult } from '../core/CLIResult.js';
import { CLIExitCode } from '../core/CLIExitCode.js';
import { HybridRetrievalEngine } from '../../retrieval/engine/HybridRetrievalEngine.js';
import { SemanticIndex } from '../../retrieval/index/SemanticIndex.js';
import { LocalSemanticEmbeddingProvider } from '../../retrieval/embeddings/LocalSemanticEmbeddingProvider.js';

export class SearchCommand implements CLICommand {
  public readonly name = 'search';
  public readonly description = 'Search repository knowledge and semantic indices (Phase 9.4)';
  public readonly aliases: readonly string[] = ['find', 'query'];

  public readonly help: CLICommandHelp = {
    summary: 'Search repository knowledge, features, and symbols with hybrid ranking.',
    usage: 'projectmind search <query> [options]',
    examples: [
      'projectmind search "authentication implementation"',
      'projectmind search "database session timeout" --limit 5',
      'projectmind search "payment gateway" --json',
    ],
    options: [
      { name: 'limit', description: 'Maximum number of results to return (default: 10)', type: 'string' },
      { name: 'min-score', description: 'Minimum relevance/similarity score threshold (default: 0.15)', type: 'string' },
      { name: 'json', description: 'Output search results formatted as raw JSON', type: 'boolean' },
    ],
  };

  constructor(private readonly retrievalEngine?: HybridRetrievalEngine | undefined) {}

  public async execute(context: CLIContext): Promise<CLIResult> {
    const queryText = context.args[0];
    if (!queryText || queryText.trim().length === 0) {
      return createErrorResult(
        'Missing required search query. Usage: projectmind search <query>',
        CLIExitCode.INVALID_ARGUMENT
      );
    }

    const limit = context.getOption('limit') !== undefined ? Number(context.getOption('limit')) : 10;
    const minScore = context.getOption('min-score') !== undefined ? Number(context.getOption('min-score')) : 0.15;
    const engine =
      this.retrievalEngine ??
      new HybridRetrievalEngine(
        new SemanticIndex(),
        new LocalSemanticEmbeddingProvider()
      );

    try {
      const results = await engine.retrieve({
        queryId: `cli_search_${Date.now()}`,
        workspaceId: context.workspacePath ?? 'default',
        repositoryId: 'default',
        text: queryText,
        queryType: 'UNKNOWN',
        filters: { limit, minScore },
        timestamp: Date.now(),
      });

      if (context.format === 'json' || context.getOption('json')) {
        return createSuccessResult({
          query: queryText,
          count: results.length,
          results,
        });
      }

      const lines: string[] = [
        `\x1b[1;36mSearch Results for:\x1b[0m "${queryText}" (${results.length} matches)`,
        '',
      ];

      if (results.length === 0) {
        lines.push('  No matching resources found.');
      } else {
        for (const res of results) {
          const scorePercent = Math.round(res.score * 100);
          lines.push(
            `  \x1b[1;32m[${res.source}]\x1b[0m \x1b[1m${res.name}\x1b[0m (Score: ${scorePercent}%, Authority: ${res.authority})`
          );
          if (res.snippet) {
            lines.push(`    \x1b[90m${res.snippet.slice(0, 100)}...\x1b[0m`);
          }
          if (res.evidence.length > 0) {
            lines.push(`    \x1b[33mEvidence:\x1b[0m ${res.evidence.join('; ')}`);
          }
          lines.push('');
        }
      }

      return createSuccessResult(
        { query: queryText, count: results.length, results },
        lines.join('\n')
      );
    } catch (err: any) {
      return createErrorResult(
        `Search execution failed: ${err.message}`,
        CLIExitCode.INTERNAL_ERROR
      );
    }
  }
}
