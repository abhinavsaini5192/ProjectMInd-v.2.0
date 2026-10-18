import { KnowledgeRetriever } from '../retrieval/RetrievalEngines';
import type { Fact } from '../../extraction/models/Fact.js';
import type { SelectedFile } from '../models/ContextModels.js';

export class IntentRouter {
  public routeIntent(userPrompt: string): string {
    const prompt = userPrompt.toLowerCase();
    if (prompt.includes('bug') || prompt.includes('fix')) return 'Bug Fix';
    if (prompt.includes('refactor') || prompt.includes('clean')) return 'Refactoring';
    if (prompt.includes('test')) return 'Testing';
    return 'Feature Development';
  }
}

export class ContextPlanner {
  public planRetrieval(intent: string, keyword: string): string[] {
    // Determine retrieval strategy. For MVP, we just use a keyword strategy.
    return [keyword];
  }
}

export class ContextExpander {
  private retriever: KnowledgeRetriever;

  constructor(retriever: KnowledgeRetriever) {
    this.retriever = retriever;
  }

  public expandContext(keywords: string[]): Fact[] {
    const facts: Fact[] = [];
    for (const kw of keywords) {
      facts.push(...this.retriever.querySymbols(kw));
    }
    // In a full implementation, this would look at `relationships` on facts and recursively fetch them.
    return facts;
  }
}

export class FileSelectionEngine {
  public selectFiles(facts: Fact[]): SelectedFile[] {
    const files = new Map<string, SelectedFile>();
    
    for (const fact of facts) {
      if (!files.has(fact.sourceFile)) {
        files.set(fact.sourceFile, {
          path: fact.sourceFile,
          justification: `Contains ${fact.id} required for the task.`
        });
      }
    }

    return Array.from(files.values());
  }
}
