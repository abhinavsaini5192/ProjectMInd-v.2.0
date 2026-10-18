export interface KnowledgeUpdateReference {
  readonly referenceType: 'OBSERVATION' | 'VERIFICATION' | 'COMMIT' | 'FILE' | 'FEATURE' | 'TASK' | 'SESSION';
  readonly referenceId: string;
  readonly description?: string | undefined;
  readonly timestamp?: number | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
}
