export enum ChangeType {
  Added = 'Added',
  Modified = 'Modified',
  Deleted = 'Deleted',
  Renamed = 'Renamed'
}

export interface RepositoryChange {
  changeType: ChangeType;
  path: string;
  oldPath?: string;
  diffSnippet?: string;
}

export interface ASTChange {
  symbolName: string;
  changeType: ChangeType;
  nodeType: string; // e.g., 'Class', 'Function', 'Method'
  filePath: string;
  previousSignature?: string;
  newSignature?: string;
}

export interface GenericASTNode {
  type: string;
  name: string;
  signature: string;
}
