import type { ContextPackage } from '../models/ContextModels.js';
import { ProjectMindError } from '../../errors';

export class TokenOptimizer {
  private readonly maxTokens: number;

  constructor(maxTokens: number = 32000) {
    this.maxTokens = maxTokens;
  }

  /**
   * Fast heuristic: 1 token = 4 characters.
   */
  public estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Truncates or compresses text to fit the budget.
   */
  public optimize(text: string): string {
    const tokens = this.estimateTokens(text);
    if (tokens <= this.maxTokens) return text;
    
    // Hard cutoff for MVP. In reality, we'd prune low-priority graph nodes first.
    const maxChars = this.maxTokens * 4;
    return text.substring(0, maxChars) + '\n...[Context Truncated for Token Budget]';
  }
}

export class PromptContextBuilder {
  public buildRawContext(pkg: ContextPackage): string {
    let output = `<ProjectState>\n${pkg.projectState}\n</ProjectState>\n\n`;
    
    output += `<SelectedFiles>\n`;
    for (const file of pkg.relevantFiles) {
      output += `- ${file.path} (Reason: ${file.justification})\n`;
    }
    output += `</SelectedFiles>\n\n`;

    output += `<RelevantSymbols>\n`;
    for (const sym of pkg.relevantSymbols) {
      output += `- ${sym}\n`;
    }
    output += `</RelevantSymbols>\n`;

    return output;
  }
}

export class VerificationEngine {
  public verify(pkg: ContextPackage): void {
    if (!pkg.relevantFiles || pkg.relevantFiles.length === 0) {
      // It's technically okay for context to be empty, but we might want to warn.
    }
    if (pkg.estimatedTokens > 100000) {
      throw new ProjectMindError('Context overload detected prior to output.', 'CONTEXT_OVERLOAD');
    }
  }
}
