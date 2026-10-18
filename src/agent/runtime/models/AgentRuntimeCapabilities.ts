export interface AgentRuntimeCapabilities {
  readonly multiSession: boolean;
  readonly multiTask: boolean;
  readonly taskPausing: boolean;
  readonly contextRefresh: boolean;
  readonly contextPinning: boolean;
  readonly checkpointing: boolean;
  readonly recovery: boolean;
  readonly streaming: boolean;
  readonly verificationGating: boolean;
  readonly knowledgeUpdates: boolean;
}

export const DEFAULT_RUNTIME_CAPABILITIES: AgentRuntimeCapabilities = {
  multiSession: true,
  multiTask: true,
  taskPausing: true,
  contextRefresh: true,
  contextPinning: true,
  checkpointing: true,
  recovery: true,
  streaming: true,
  verificationGating: true,
  knowledgeUpdates: true,
};
