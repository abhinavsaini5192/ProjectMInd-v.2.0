export type ReferenceType =
  | 'FILE'
  | 'SYMBOL'
  | 'ENDPOINT'
  | 'FEATURE'
  | 'FLOW'
  | 'TEST'
  | 'DOCUMENT';

export interface FeatureKnowledgeReference {
  id: string;
  name: string;
  type: ReferenceType;
  path?: string | undefined;
  confidence: number;
  role?: string | undefined;
  details?: Record<string, any> | undefined;
}
