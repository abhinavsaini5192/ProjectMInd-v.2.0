export interface ProjectAnalysisSettings {
  readonly autoScan?: boolean | undefined;
  readonly defaultBranch?: string | undefined;
  readonly excludePatterns?: readonly string[] | undefined;
  readonly maxFileSizeBytes?: number | undefined;
}

export interface ProjectContextSettings {
  readonly defaultTokenBudget?: number | undefined;
  readonly maxTokens?: number | undefined;
  readonly packingStrategy?: 'PROPORTIONAL_DYNAMIC' | 'GREEDY' | 'HIERARCHICAL' | undefined;
  readonly maxIncludedFiles?: number | undefined;
  readonly enableMarkdownCompression?: boolean | undefined;
}

export interface ProjectFeatureSettings {
  readonly discoveryEnabled?: boolean | undefined;
  readonly autoDiscover?: boolean | undefined;
  readonly autoTagging?: boolean | undefined;
  readonly healthThreshold?: number | undefined;
}

export interface ProjectAgentSettings {
  readonly maxConcurrentSessions?: number | undefined;
  readonly allowedTools?: readonly string[] | undefined;
  readonly requireHumanApprovalForExecution?: boolean | undefined;
}

export interface ProjectSecuritySettings {
  readonly enforceWorkspaceIsolation: boolean;
  readonly allowCrossRepoAnalysis?: boolean | undefined;
  readonly secretRedactionEnabled: boolean;
}

export interface ProjectSettings {
  readonly analysis: ProjectAnalysisSettings;
  readonly context: ProjectContextSettings;
  readonly features: ProjectFeatureSettings;
  readonly agent: ProjectAgentSettings;
  readonly security: ProjectSecuritySettings;
  readonly custom?: Readonly<Record<string, unknown>> | undefined;
}

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  analysis: {
    autoScan: true,
    defaultBranch: 'main',
    excludePatterns: ['node_modules/**', 'dist/**', '.git/**'],
    maxFileSizeBytes: 1024 * 1024 * 2, // 2MB
  },
  context: {
    defaultTokenBudget: 4000,
    packingStrategy: 'PROPORTIONAL_DYNAMIC',
    maxIncludedFiles: 25,
    enableMarkdownCompression: true,
  },
  features: {
    discoveryEnabled: true,
    autoTagging: true,
    healthThreshold: 80,
  },
  agent: {
    maxConcurrentSessions: 10,
    allowedTools: ['read_file', 'grep_search', 'list_dir'],
    requireHumanApprovalForExecution: false,
  },
  security: {
    enforceWorkspaceIsolation: true,
    allowCrossRepoAnalysis: false,
    secretRedactionEnabled: true,
  },
};
