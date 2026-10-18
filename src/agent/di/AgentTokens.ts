export const AgentTokens = {
  IAgentRuntime: Symbol.for('IAgentRuntime'),
  IAgentRegistry: Symbol.for('IAgentRegistry'),
  IAgentSessionManager: Symbol.for('IAgentSessionManager'),
  IAgentCapabilityResolver: Symbol.for('IAgentCapabilityResolver'),
  IAgentOperationRouter: Symbol.for('IAgentOperationRouter'),
  IAdapterRegistry: Symbol.for('IAdapterRegistry'),

  // Operation Handlers
  GetContextHandler: Symbol.for('GetContextHandler'),
  GetFeatureHandler: Symbol.for('GetFeatureHandler'),
  GetFeatureContextHandler: Symbol.for('GetFeatureContextHandler'),
  GetImpactHandler: Symbol.for('GetImpactHandler'),
  GetArchitectureHandler: Symbol.for('GetArchitectureHandler'),
  GetHistoryHandler: Symbol.for('GetHistoryHandler'),
  GetHealthHandler: Symbol.for('GetHealthHandler'),
  ExplainContextHandler: Symbol.for('ExplainContextHandler'),
  RefreshContextHandler: Symbol.for('RefreshContextHandler'),
  ReportExecutionHandler: Symbol.for('ReportExecutionHandler'),
  ReportVerificationHandler: Symbol.for('ReportVerificationHandler'),
  UpdateKnowledgeHandler: Symbol.for('UpdateKnowledgeHandler'),
};
