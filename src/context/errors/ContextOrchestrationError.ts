export class ContextOrchestrationError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'CONTEXT_ORCHESTRATION_ERROR',
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = 'ContextOrchestrationError';
  }
}
