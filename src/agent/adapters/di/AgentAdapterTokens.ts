export const AgentAdapterTokens = {
  IAgentAdapterRegistry: Symbol.for('IAgentAdapterRegistry'),
  IAgentAdapterResolver: Symbol.for('IAgentAdapterResolver'),
  IAgentCapabilityMapper: Symbol.for('IAgentCapabilityMapper'),
  IAgentToolMapper: Symbol.for('IAgentToolMapper'),
  IAgentContextMapper: Symbol.for('IAgentContextMapper'),
  IAgentSessionMapper: Symbol.for('IAgentSessionMapper'),
  IAgentProtocolTranslator: Symbol.for('IAgentProtocolTranslator'),
  IAgentAdapterValidator: Symbol.for('IAgentAdapterValidator'),
  IAgentAdapterManager: Symbol.for('IAgentAdapterManager'),

  // Concrete Adapters
  GenericAgentAdapter: Symbol.for('GenericAgentAdapter'),
  McpAgentAdapter: Symbol.for('McpAgentAdapter'),
  GenericCliAdapter: Symbol.for('GenericCliAdapter'),
  IdeAgentAdapter: Symbol.for('IdeAgentAdapter'),
} as const;
