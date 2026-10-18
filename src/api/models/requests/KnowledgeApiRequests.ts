import type { KnowledgeUpdateSource } from '../../../knowledge/update/models/KnowledgeUpdateSource.js';
import type { KnowledgeUpdateType } from '../../../knowledge/update/models/KnowledgeUpdateType.js';
import type { KnowledgeUpdateProvenance } from '../../../knowledge/update/models/KnowledgeUpdateProvenance.js';
import type { KnowledgeArea } from '../../../knowledge/update/models/KnowledgeArea.js';
import type { KnowledgeUpdateReference } from '../../../knowledge/update/models/KnowledgeUpdateReference.js';

export interface CreateKnowledgeUpdateRequestBody {
  readonly source: KnowledgeUpdateSource;
  readonly updateType: KnowledgeUpdateType;
  readonly provenance?: KnowledgeUpdateProvenance | undefined;
  readonly affectedResources?: readonly string[] | undefined;
  readonly affectedFeatures?: readonly string[] | undefined;
  readonly affectedKnowledgeAreas?: readonly KnowledgeArea[] | undefined;
  readonly evidenceReferences?: readonly KnowledgeUpdateReference[] | undefined;
  readonly confidence?: number | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
}

export interface RetryKnowledgeUpdateRequestBody {
  readonly reason?: string | undefined;
}
