import { ASTChange, GenericASTNode } from '../models/RepositoryChange.js';

export class RepositoryScanner {
  /**
   * A simulated repository scanner that parses raw files into GenericASTNodes.
   * In a real implementation, this wraps ts-morph or @babel/parser.
   */
  public scan(filePath: string, content: string): GenericASTNode[] {
    const nodes: GenericASTNode[] = [];
    
    // Very rudimentary parser logic for deterministic tests
    const lines = content.split('\n');
    for (const line of lines) {
      if (line.includes('export class')) {
        const name = line.split('class ')[1]?.split(' ')[0];
        if (name) nodes.push({ type: 'Class', name, signature: line.trim() });
      } else if (line.includes('export function')) {
        const name = line.split('function ')[1]?.split('(')[0];
        if (name) nodes.push({ type: 'Function', name, signature: line.trim() });
      }
    }
    
    return nodes;
  }
}
