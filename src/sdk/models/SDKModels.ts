export interface SDKContextRequest {
  readonly query: string;
  readonly maxTokens?: number | undefined;
  readonly includeDependencies?: boolean | undefined;
}

export interface SDKContextResponse {
  readonly bundleId: string;
  readonly resources: readonly {
    readonly uri: string;
    readonly content: string;
    readonly score: number;
    readonly reason: string;
  }[];
  readonly totalTokens: number;
  readonly completenessScore: number;
}

export interface SDKFeatureInfo {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly status: string;
  readonly associatedFiles: readonly string[];
}

export interface SDKTaskPlanNode {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly dependencies: readonly string[];
  readonly assignedAgentRole?: string | undefined;
}

export interface SDKTaskPlan {
  readonly planId: string;
  readonly title: string;
  readonly status: string;
  readonly nodes: readonly SDKTaskPlanNode[];
  readonly createdAt: string;
}

export interface SDKFeedbackSubmission {
  readonly feedbackType: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly signal: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'CONFIRM' | 'REJECT';
  readonly value?: number | undefined;
  readonly commentary?: string | undefined;
}

export interface SDKPluginRegistration {
  readonly pluginId: string;
  readonly name: string;
  readonly version: string;
  readonly state: string;
  readonly publisher: string;
  readonly pluginType: string;
}
