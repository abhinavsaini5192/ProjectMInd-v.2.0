import { Parser, Tree, Node, Language } from 'web-tree-sitter';
import { ProjectMindError } from '../errors/index.js';

/**
 * Handles initialization of the WebAssembly-based Tree-sitter engine.
 */
export class ASTEngine {
  private isInitialized = false;

  /**
   * Must be called before any parsing happens.
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;
    try {
      await Parser.init();
      this.isInitialized = true;
    } catch (err: any) {
      throw new ProjectMindError(`Failed to initialize tree-sitter: ${err.message}`, 'AST_ENGINE_INIT_FAILED');
    }
  }

  /**
   * Loads a specific language WASM module.
   */
  public async loadLanguage(wasmFilePath: string): Promise<Language> {
    if (!this.isInitialized) {
      throw new ProjectMindError('ASTEngine not initialized.', 'AST_ENGINE_NOT_INITIALIZED');
    }
    try {
      return await Language.load(wasmFilePath);
    } catch (err: any) {
      throw new ProjectMindError(`Failed to load language WASM at ${wasmFilePath}: ${err.message}`, 'LANGUAGE_LOAD_FAILED');
    }
  }

  /**
   * Creates a parser instance for a specific loaded language.
   */
  public createParser(language: Language): Parser {
    const parser = new Parser();
    parser.setLanguage(language);
    return parser;
  }
}
