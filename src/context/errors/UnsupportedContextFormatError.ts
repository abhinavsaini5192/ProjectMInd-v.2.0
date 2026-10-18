import { ContextAdapterError } from './ContextAdapterError.js';

export class UnsupportedContextFormatError extends ContextAdapterError {
  constructor(format: string, details?: Record<string, any>) {
    super(`Unsupported context format: ${format}`, details);
    this.name = 'UnsupportedContextFormatError';
  }
}
