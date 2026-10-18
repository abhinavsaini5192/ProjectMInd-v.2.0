import type { KnowledgeGraph } from '../../intelligence/engines/KnowledgeGraphBuilder.js';
import type { Fact } from '../../extraction/models/Fact.js';

export class KnowledgeRetriever {
  private graph: KnowledgeGraph;

  constructor(graph: KnowledgeGraph) {
    this.graph = graph;
  }

  /**
   * Retrieves symbols that match a specific keyword.
   */
  public querySymbols(keyword: string): Fact[] {
    const results: Fact[] = [];
    for (const [id, fact] of this.graph.facts.entries()) {
      if (id.toLowerCase().includes(keyword.toLowerCase())) {
        results.push(fact);
      }
    }
    return results;
  }

  public getProjectStateSummary(): string {
    return this.graph.semanticEvents.slice(-5).map(e => e.summary).join('\n');
  }
}

export class ContextCache {
  private cache: Map<string, string> = new Map();

  public get(key: string): string | undefined {
    return this.cache.get(key);
  }

  public set(key: string, value: string): void {
    this.cache.set(key, value);
  }

  public invalidate(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }
}
