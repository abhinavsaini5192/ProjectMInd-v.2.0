import type { KnowledgeUpdate } from '../models/KnowledgeUpdate.js';

export interface IKnowledgeUpdateValidator {
  validate(update: KnowledgeUpdate): void;
  sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown>;
}
