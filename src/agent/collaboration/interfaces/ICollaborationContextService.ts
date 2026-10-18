export interface ICollaborationContextService {
  /**
   * Builds shared project context accessible to all authorized participants in the collaboration.
   */
  buildSharedContext(collaborationSessionId: string): Promise<Record<string, unknown>>;

  /**
   * Builds an agent-specific, task-scoped context package using Context Intelligence (Phase 9.3)
   * while filtering out other agents' private scratchpads and unshared notes.
   */
  buildAgentContext(
    collaborationSessionId: string,
    agentId: string,
    taskId?: string
  ): Promise<any>;
}
