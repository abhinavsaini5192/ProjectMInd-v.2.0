import { Service } from '../interfaces/index.js';
import { ASTEngine } from './ASTEngine.js';
import { ParserFramework } from './ParserFramework.js';
import { DiffEngine } from './DiffEngine.js';
import { FileDiscoveryEngine } from './FileDiscoveryEngine.js';
import { TypescriptParser, JavascriptParser, PythonParser } from './parsers/MVParsers.js';
import { ProjectMindError } from '../errors/index.js';

/**
 * ExtractionService bridges Phase 2 (Extraction) into Phase 1 (Kernel).
 */
export class ExtractionService implements Service {
  public readonly name = 'extraction-engine';
  
  public astEngine: ASTEngine;
  public parserFramework: ParserFramework;
  public diffEngine: DiffEngine;
  public fileDiscovery: FileDiscoveryEngine;

  constructor(workspacePath: string) {
    this.astEngine = new ASTEngine();
    this.parserFramework = new ParserFramework();
    this.diffEngine = new DiffEngine(workspacePath);
    this.fileDiscovery = new FileDiscoveryEngine();
  }

  public async initialize(): Promise<void> {
    try {
      await this.astEngine.initialize();
      // Note: In a real environment, we'd load the .wasm files dynamically based on configuration.
      // For the interface level, we assume ASTEngine is ready.
    } catch (err: any) {
      throw new ProjectMindError(`Failed to initialize ExtractionService: ${err.message}`, 'EXTRACTION_INIT_FAILED');
    }
  }

  public async shutdown(): Promise<void> {
    // Cleanup if necessary
  }
}
