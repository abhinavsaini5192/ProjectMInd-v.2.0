import type { ContextPackage } from '../models/ContextModels.js';

export interface AgentAdapter {
  formatContext(pkg: ContextPackage): string;
}

/**
 * Optimizes the context payload heavily for Claude-style agents, utilizing XML tags extensively.
 */
export class ClaudeAdapter implements AgentAdapter {
  public formatContext(pkg: ContextPackage): string {
    return `<project_mind_context>
  <task_intent>${pkg.taskIntent}</task_intent>
  <project_state>${pkg.projectState}</project_state>
  <relevant_files>
    ${pkg.relevantFiles.map(f => `<file path="${f.path}" reason="${f.justification}" />`).join('\n    ')}
  </relevant_files>
  <relevant_symbols>
    ${pkg.relevantSymbols.map(s => `<symbol id="${s}" />`).join('\n    ')}
  </relevant_symbols>
</project_mind_context>`;
  }
}

/**
 * Optimizes the context payload for Cursor / standard Markdown-based agents.
 */
export class GenericMarkdownAdapter implements AgentAdapter {
  public formatContext(pkg: ContextPackage): string {
    return `# ProjectMind Context
**Task Intent:** ${pkg.taskIntent}

## Project State
${pkg.projectState}

## Relevant Files
${pkg.relevantFiles.map(f => `- \`${f.path}\`: ${f.justification}`).join('\n')}

## Relevant Symbols
${pkg.relevantSymbols.map(s => `- \`${s}\``).join('\n')}
`;
  }
}
