export class KnowledgeUpdateError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'KNOWLEDGE_UPDATE_ERROR',
    public readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'KnowledgeUpdateError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidKnowledgeUpdateError extends KnowledgeUpdateError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message, 'INVALID_KNOWLEDGE_UPDATE', details);
    this.name = 'InvalidKnowledgeUpdateError';
  }
}

export class KnowledgeConflictError extends KnowledgeUpdateError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message, 'KNOWLEDGE_CONFLICT_ERROR', details);
    this.name = 'KnowledgeConflictError';
  }
}

export class KnowledgeVersionConflictError extends KnowledgeUpdateError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message, 'KNOWLEDGE_VERSION_CONFLICT', details);
    this.name = 'KnowledgeVersionConflictError';
  }
}

export class KnowledgeUpdateNotFoundError extends KnowledgeUpdateError {
  constructor(updateId: string, details: Record<string, unknown> = {}) {
    super(`Knowledge update '${updateId}' not found.`, 'KNOWLEDGE_UPDATE_NOT_FOUND', {
      updateId,
      ...details,
    });
    this.name = 'KnowledgeUpdateNotFoundError';
  }
}

export class KnowledgeUpdateScopeError extends KnowledgeUpdateError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message, 'KNOWLEDGE_UPDATE_SCOPE_ERROR', details);
    this.name = 'KnowledgeUpdateScopeError';
  }
}

export class KnowledgeUpdateProcessingError extends KnowledgeUpdateError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message, 'KNOWLEDGE_UPDATE_PROCESSING_ERROR', details);
    this.name = 'KnowledgeUpdateProcessingError';
  }
}
