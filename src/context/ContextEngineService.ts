import type { Service } from '../interfaces/index.js';
import type { KnowledgeGraph } from '../intelligence/engines/KnowledgeGraphBuilder.js';
import type { ContextPackage } from './models/ContextModels.js';
import { KnowledgeRetriever, ContextCache } from './retrieval/RetrievalEngines.js';
import { IntentRouter, ContextPlanner, ContextExpander, FileSelectionEngine } from './planning/PlanningEngines.js';
import { TokenOptimizer, PromptContextBuilder, VerificationEngine } from './optimization/OptimizationEngines.js';
import type { AgentAdapter } from './adapters/AgentAdapters.js';
import { GenericMarkdownAdapter } from './adapters/AgentAdapters.js';
import { ProjectMindError } from '../errors';

/**
 * Facade for Phase 4 Context Engine.
 */
export class ContextEngineService implements Service {
  public readonly name = 'context-engine';
  
  private cache: ContextCache;
  private router: IntentRouter;
  private planner: ContextPlanner;
  private fileSelector: FileSelectionEngine;
  private builder: PromptContextBuilder;
  private optimizer: TokenOptimizer;
  private verifier: VerificationEngine;

  constructor() {
    this.cache = new ContextCache();
    this.router = new IntentRouter();
    this.planner = new ContextPlanner();
    this.fileSelector = new FileSelectionEngine();
    this.builder = new PromptContextBuilder();
    this.optimizer = new TokenOptimizer();
    this.verifier = new VerificationEngine();
  }

  public async initialize(): Promise<void> {}
  public async shutdown(): Promise<void> {}

  /**
   * Main API for generating AI context based on a user prompt and a keyword.
   */
  public generateContext(userPrompt: string, targetKeyword: string, graph: KnowledgeGraph, adapter: AgentAdapter = new GenericMarkdownAdapter()): string {
    try {
      // 1. Check cache (simplified caching strategy based on keyword for MVP)
      const cached = this.cache.get(targetKeyword);
      if (cached) return cached;

      // 2. Initialize Retriever
      const retriever = new KnowledgeRetriever(graph);
      const expander = new ContextExpander(retriever);

      // 3. Plan & Expand
      const intent = this.router.routeIntent(userPrompt);
      const keywords = this.planner.planRetrieval(intent, targetKeyword);
      const facts = expander.expandContext(keywords);
      
      // 4. File Selection
      const files = this.fileSelector.selectFiles(facts);

      // 5. Build Package
      const pkg: ContextPackage = {
        taskIntent: intent,
        projectState: retriever.getProjectStateSummary(),
        relevantFiles: files,
        relevantSymbols: facts.map(f => f.id),
        estimatedTokens: 0
      };

      // 6. Format using adapter
      const rawText = adapter.formatContext(pkg);

      // 7. Optimize tokens
      const optimizedText = this.optimizer.optimize(rawText);
      pkg.compiledPromptText = optimizedText;
      pkg.estimatedTokens = this.optimizer.estimateTokens(optimizedText);

      // 8. Verify & Cache
      this.verifier.verify(pkg);
      this.cache.set(targetKeyword, optimizedText);

      return optimizedText;
    } catch (err: any) {
      throw new ProjectMindError(`Context Engine failed to generate context: ${err.message}`, 'CONTEXT_GENERATION_FAILED');
    }
  }
}
