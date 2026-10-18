import type { CLICommand, CLICommandHelp } from '../core/CLICommand.js';
import type { CLIContext } from '../core/CLIContext.js';
import { type CLIResult, createSuccessResult, createErrorResult } from '../core/CLIResult.js';
import { CLIExitCode } from '../core/CLIExitCode.js';
import type { IProjectMemoryManager } from '../../memory/project/interfaces/IProjectMemoryManager.js';
import { ProjectMemoryManager } from '../../memory/project/services/ProjectMemoryManager.js';
import { InMemoryProjectMemoryStore } from '../../memory/project/services/InMemoryProjectMemoryStore.js';

export class MemoryCommand implements CLICommand {
  public readonly name = 'memory';
  public readonly description = 'Inspect and manage durable project memory and decisions (Phase 9.4)';
  public readonly aliases: readonly string[] = ['mem'];

  public readonly help: CLICommandHelp = {
    summary: 'Manage durable project decisions, architectural memory, and historical records.',
    usage: 'projectmind memory <subcommand> [args] [options]',
    examples: [
      'projectmind memory list',
      'projectmind memory search "why Redis?"',
      'projectmind memory show mem_12345',
      'projectmind memory candidates',
      'projectmind memory promote cand_12345',
    ],
    subcommands: [
      { name: 'list', description: 'List active durable project memories' },
      { name: 'search', description: 'Search memories matching a query' },
      { name: 'show', description: 'Show details of a specific memory by ID' },
      { name: 'candidates', description: 'List pending memory candidates awaiting promotion' },
      { name: 'promote', description: 'Promote a proposed candidate into active memory' },
    ],
    options: [
      { name: 'json', description: 'Output results in JSON format', type: 'boolean' },
    ],
  };

  private readonly manager: IProjectMemoryManager;
  private readonly store: InMemoryProjectMemoryStore;

  constructor(manager?: IProjectMemoryManager | undefined, store?: InMemoryProjectMemoryStore | undefined) {
    this.store = store ?? new InMemoryProjectMemoryStore();
    this.manager = manager ?? new ProjectMemoryManager(this.store);
  }

  public async execute(context: CLIContext): Promise<CLIResult> {
    const subcommand = context.args[0] ?? 'list';

    switch (subcommand) {
      case 'list': {
        const memories = await this.manager.queryMemories({
          workspaceId: context.workspacePath ?? 'default',
          status: ['ACTIVE'],
        });

        if (context.format === 'json' || context.getOption('json')) {
          return createSuccessResult({ count: memories.length, memories });
        }

        const lines = [`\x1b[1;36mActive Project Memories (${memories.length}):\x1b[0m`, ''];
        if (memories.length === 0) {
          lines.push('  No active memories recorded.');
        } else {
          for (const m of memories) {
            lines.push(`  \x1b[1m[${m.type}]\x1b[0m \x1b[32m${m.title}\x1b[0m (ID: ${m.memoryId})`);
            lines.push(`    Authority: \x1b[33m${m.authority}\x1b[0m | Provenance: ${m.provenance}`);
            lines.push(`    \x1b[90m${m.content.slice(0, 100)}...\x1b[0m`);
            lines.push('');
          }
        }
        return createSuccessResult({ count: memories.length, memories }, lines.join('\n'));
      }

      case 'search': {
        const query = context.args.slice(1).join(' ');
        if (!query) {
          return createErrorResult('Missing search query: projectmind memory search <query>', CLIExitCode.INVALID_ARGUMENT);
        }

        const memories = await this.manager.queryMemories({
          workspaceId: context.workspacePath ?? 'default',
          status: ['ACTIVE'],
        });

        const qLower = query.toLowerCase();
        const matches = memories.filter(
          (m) => m.title.toLowerCase().includes(qLower) || m.content.toLowerCase().includes(qLower)
        );

        if (context.format === 'json' || context.getOption('json')) {
          return createSuccessResult({ query, count: matches.length, matches });
        }

        const lines = [`\x1b[1;36mMemory Search for "${query}" (${matches.length} matches):\x1b[0m`, ''];
        for (const m of matches) {
          lines.push(`  \x1b[1m[${m.type}]\x1b[0m \x1b[32m${m.title}\x1b[0m (ID: ${m.memoryId})`);
          lines.push(`    ${m.content}`);
          lines.push('');
        }
        return createSuccessResult({ query, count: matches.length, matches }, lines.join('\n'));
      }

      case 'show': {
        const memoryId = context.args[1];
        if (!memoryId) {
          return createErrorResult('Missing memory ID: projectmind memory show <id>', CLIExitCode.INVALID_ARGUMENT);
        }

        const mem = await this.store.get(memoryId);
        if (!mem) {
          return createErrorResult(`Memory '${memoryId}' not found`, CLIExitCode.NOT_FOUND);
        }

        if (context.format === 'json' || context.getOption('json')) {
          return createSuccessResult(mem);
        }

        const lines = [
          `\x1b[1;36mProject Memory Details:\x1b[0m`,
          `  ID:          ${mem.memoryId}`,
          `  Title:       ${mem.title}`,
          `  Type:        ${mem.type}`,
          `  Status:      ${mem.status}`,
          `  Authority:   ${mem.authority}`,
          `  Provenance:  ${mem.provenance}`,
          `  Confidence:  ${Math.round(mem.confidence * 100)}%`,
          `  Content:     ${mem.content}`,
          `  Resources:   ${mem.relatedResources.join(', ') || 'None'}`,
          `  Features:    ${mem.relatedFeatures.join(', ') || 'None'}`,
        ];
        return createSuccessResult(mem, lines.join('\n'));
      }

      case 'candidates': {
        const candidates = await this.store.listCandidates('default');
        if (context.format === 'json' || context.getOption('json')) {
          return createSuccessResult({ count: candidates.length, candidates });
        }

        const lines = [`\x1b[1;36mPending Memory Candidates (${candidates.length}):\x1b[0m`, ''];
        for (const c of candidates) {
          lines.push(`  \x1b[1m${c.title}\x1b[0m (ID: ${c.candidateId})`);
          lines.push(`    Type: ${c.type} | Provenance: ${c.provenance} | Authority: ${c.authority}`);
          lines.push('');
        }
        return createSuccessResult({ count: candidates.length, candidates }, lines.join('\n'));
      }

      case 'promote': {
        const candId = context.args[1];
        if (!candId) {
          return createErrorResult('Missing candidate ID: projectmind memory promote <id>', CLIExitCode.INVALID_ARGUMENT);
        }

        try {
          const promoted = await this.manager.promoteCandidate(candId);
          return createSuccessResult(
            promoted,
            `Successfully promoted candidate '${candId}' to active Memory '${promoted.memoryId}' (${promoted.authority})`
          );
        } catch (err: any) {
          return createErrorResult(`Promotion failed: ${err.message}`, CLIExitCode.INTERNAL_ERROR);
        }
      }

      default:
        return createErrorResult(
          `Unknown memory subcommand '${subcommand}'. Valid subcommands: list, search, show, candidates, promote`,
          CLIExitCode.INVALID_ARGUMENT
        );
    }
  }
}
