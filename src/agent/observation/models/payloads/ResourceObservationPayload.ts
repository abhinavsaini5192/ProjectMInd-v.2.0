import type { MappingResourceType } from '../../../../knowledge/features/mapping/models/MappingResourceType.js';

export type ResourceChangeType =
  | 'CREATED'
  | 'MODIFIED'
  | 'DELETED'
  | 'RENAMED'
  | 'MOVED'
  | 'ACCESSED';

export interface ResourceObservationPayload {
  readonly resourceId?: string | undefined;
  readonly resourceType: MappingResourceType;
  readonly path: string;
  readonly oldPath?: string | undefined;
  readonly symbolName?: string | undefined;
  readonly changeType: ResourceChangeType;
  readonly details?: Record<string, unknown> | undefined;
}
