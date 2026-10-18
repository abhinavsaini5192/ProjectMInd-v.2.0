import type { CollaborationConflict } from '../models/index.js';

export interface IConflictDetector {
  detectConflicts(collaborationSessionId: string): Promise<CollaborationConflict[]>;
  checkResourceConflict(
    collaborationSessionId: string,
    resourceId: string,
    requestingAgentId: string
  ): Promise<CollaborationConflict | null>;
  checkTaskConflict(
    collaborationSessionId: string,
    taskId: string,
    requestingAgentId: string
  ): Promise<CollaborationConflict | null>;
}
