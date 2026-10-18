import type { ContextRequest } from '../models/ContextRequest.js';

export class ContextCacheKeyBuilder {
  public static buildKey(request: ContextRequest): string {
    const projectId = request.projectId ?? request.projectContext?.projectId ?? 'default';
    const knowledgeVersion = String(request.projectContext?.knowledgeVersion ?? 1);

    const parts: string[] = [
      request.workspaceId,
      projectId,
      request.repositoryId,
      (request.featureIds ?? []).slice().sort().join(','),
      (request.resourceIds ?? []).slice().sort().join(','),
      (request.changedResources ?? []).slice().sort().join(','),
      request.taskText ?? request.query ?? '',
      String(request.tokenBudget ?? 4000),
      request.outputFormat ?? 'generic-markdown',
      String(request.maxDepth ?? 1),
      String(request.compactMode ?? false),
      request.compressionMode ?? 'COMPACT',
      knowledgeVersion,
    ];

    return `ctx:${parts.join(':')}`;
  }
}
