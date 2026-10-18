export const AgentContextTokens = {
  IAgentContextStore: Symbol.for('IAgentContextStore'),
  IAgentContextPinManager: Symbol.for('IAgentContextPinManager'),
  IAgentContextDeltaCalculator: Symbol.for('IAgentContextDeltaCalculator'),
  IAgentContextInvalidator: Symbol.for('IAgentContextInvalidator'),
  IAgentContextRefresher: Symbol.for('IAgentContextRefresher'),
  IAgentContextSessionManager: Symbol.for('IAgentContextSessionManager'),
} as const;
