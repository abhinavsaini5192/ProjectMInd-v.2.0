import type { AgentTool } from '../models/AgentTool.js';
import { AgentToolRegistry } from './AgentToolRegistry.js';

export const CANONICAL_TOOLS: readonly AgentTool[] = [
  // 1. projectmind_get_context
  {
    toolId: 'tool-get-context',
    name: 'projectmind_get_context',
    description: 'Retrieve an optimized, token-budgeted, deterministic context package for a specific development task.',
    category: 'CONTEXT',
    version: '1.0.0',
    operation: 'GET_CONTEXT',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Unique identifier for the task or prompt requiring context',
          minLength: 1,
        },
        featureId: {
          type: 'string',
          description: 'Optional feature identifier to scope context retrieval',
          minLength: 1,
        },
        targetFiles: {
          type: 'array',
          description: 'Optional explicit file paths to anchor context retrieval',
          items: { type: 'string' },
          maxItems: 50,
        },
        tokenBudget: {
          type: 'integer',
          description: 'Maximum token budget for the context package (default: 8000)',
          minimum: 100,
          maximum: 200000,
          default: 8000,
        },
        depth: {
          type: 'string',
          description: 'Context resolution depth (L0=signatures, L1=definitions, L2=expanded, L3=full)',
          enum: ['L0', 'L1', 'L2', 'L3'],
          default: 'L1',
        },
        intent: {
          type: 'string',
          description: 'Task intent driving context ranking and selection',
          enum: ['IMPLEMENTATION', 'EXPLANATION', 'REFACTORING', 'DEBUGGING', 'REVIEW'],
          default: 'IMPLEMENTATION',
        },
      },
      required: ['taskId'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        packageId: { type: 'string' },
        tokensUsed: { type: 'number' },
        resources: { type: 'array' },
        confidence: { type: 'number' },
      },
      required: ['taskId', 'packageId', 'tokensUsed'],
    },
    requiredCapabilities: ['CONTEXT_REQUEST'],
    requiredScope: 'WORKSPACE_REQUIRED',
    safetyLevel: 'READ_ONLY',
    limits: {
      maxExecutionTimeMs: 10000,
      maxPayloadBytes: 256 * 1024,
    },
    enabled: true,
    idempotent: true,
    retryable: true,
  },

  // 2. projectmind_get_feature
  {
    toolId: 'tool-get-feature',
    name: 'projectmind_get_feature',
    description: 'Query structural, behavioral, and architectural knowledge about a discovered feature.',
    category: 'FEATURE',
    version: '1.0.0',
    operation: 'GET_FEATURE',
    inputSchema: {
      type: 'object',
      properties: {
        featureId: {
          type: 'string',
          description: 'Unique feature identifier',
          minLength: 1,
        },
        includeDependencies: {
          type: 'boolean',
          description: 'Include dependency graph relationships (default: false)',
          default: false,
        },
        includeMappings: {
          type: 'boolean',
          description: 'Include file, class, and method code mappings (default: false)',
          default: false,
        },
        includeHealth: {
          type: 'boolean',
          description: 'Include feature health and stability assessment (default: false)',
          default: false,
        },
      },
      required: ['featureId'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        feature: { type: 'object' },
        found: { type: 'boolean' },
      },
      required: ['found'],
    },
    requiredCapabilities: ['FEATURE_QUERY'],
    requiredScope: 'WORKSPACE_REQUIRED',
    safetyLevel: 'READ_ONLY',
    limits: {
      maxExecutionTimeMs: 5000,
      maxPayloadBytes: 128 * 1024,
    },
    enabled: true,
    idempotent: true,
    retryable: true,
  },

  // 3. projectmind_get_feature_context
  {
    toolId: 'tool-get-feature-context',
    name: 'projectmind_get_feature_context',
    description: 'Retrieve context packaged specifically around a feature boundaries, dependencies, and code assets.',
    category: 'FEATURE',
    version: '1.0.0',
    operation: 'GET_FEATURE_CONTEXT',
    inputSchema: {
      type: 'object',
      properties: {
        featureId: {
          type: 'string',
          description: 'Unique feature identifier to gather context for',
          minLength: 1,
        },
        tokenBudget: {
          type: 'integer',
          description: 'Maximum token budget for feature context',
          minimum: 100,
          maximum: 200000,
          default: 8000,
        },
        includeRelatedFeatures: {
          type: 'boolean',
          description: 'Include adjacent directly connected features in context',
          default: true,
        },
      },
      required: ['featureId'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        featureId: { type: 'string' },
        packageId: { type: 'string' },
        resources: { type: 'array' },
      },
      required: ['featureId'],
    },
    requiredCapabilities: ['TASK_CONTEXT'],
    requiredScope: 'WORKSPACE_REQUIRED',
    safetyLevel: 'READ_ONLY',
    limits: {
      maxExecutionTimeMs: 10000,
      maxPayloadBytes: 256 * 1024,
    },
    enabled: true,
    idempotent: true,
    retryable: true,
  },

  // 4. projectmind_get_impact
  {
    toolId: 'tool-get-impact',
    name: 'projectmind_get_impact',
    description: 'Analyze direct and propagated change impact for a set of modified or planned files/features.',
    category: 'IMPACT',
    version: '1.0.0',
    operation: 'GET_IMPACT',
    inputSchema: {
      type: 'object',
      properties: {
        featureId: {
          type: 'string',
          description: 'Feature identifier to analyze impact against',
          minLength: 1,
        },
        modifiedFiles: {
          type: 'array',
          description: 'List of modified file paths to analyze impact for',
          items: { type: 'string' },
          maxItems: 100,
        },
        depth: {
          type: 'integer',
          description: 'Maximum propagation depth for impact traversal',
          minimum: 1,
          maximum: 5,
          default: 2,
        },
      },
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        impact: { type: 'object' },
        affectedFeatures: { type: 'array' },
        affectedFiles: { type: 'array' },
      },
      required: ['impact'],
    },
    requiredCapabilities: ['IMPACT_QUERY'],
    requiredScope: 'WORKSPACE_REQUIRED',
    safetyLevel: 'READ_ONLY',
    limits: {
      maxExecutionTimeMs: 10000,
      maxPayloadBytes: 256 * 1024,
    },
    enabled: true,
    idempotent: true,
    retryable: true,
  },

  // 5. projectmind_get_architecture
  {
    toolId: 'tool-get-architecture',
    name: 'projectmind_get_architecture',
    description: 'Retrieve architectural graph, dependency topologies, and component boundaries of the workspace.',
    category: 'ARCHITECTURE',
    version: '1.0.0',
    operation: 'GET_ARCHITECTURE',
    inputSchema: {
      type: 'object',
      properties: {
        featureId: {
          type: 'string',
          description: 'Optional feature identifier to scope architectural subtree',
        },
        includeExternal: {
          type: 'boolean',
          description: 'Include external module and third-party dependencies',
          default: false,
        },
        maxDepth: {
          type: 'integer',
          description: 'Maximum traversal depth of architecture hierarchy',
          minimum: 1,
          maximum: 10,
          default: 3,
        },
      },
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        components: { type: 'array' },
        boundaries: { type: 'array' },
        dependencies: { type: 'array' },
      },
      required: ['components'],
    },
    requiredCapabilities: ['ARCHITECTURE_QUERY'],
    requiredScope: 'WORKSPACE_REQUIRED',
    safetyLevel: 'READ_ONLY',
    limits: {
      maxExecutionTimeMs: 10000,
      maxPayloadBytes: 512 * 1024,
    },
    enabled: true,
    idempotent: true,
    retryable: true,
  },

  // 6. projectmind_get_history
  {
    toolId: 'tool-get-history',
    name: 'projectmind_get_history',
    description: 'Retrieve chronological evolution, refactorings, drift, and version history of a feature.',
    category: 'HISTORY',
    version: '1.0.0',
    operation: 'GET_HISTORY',
    inputSchema: {
      type: 'object',
      properties: {
        featureId: {
          type: 'string',
          description: 'Feature identifier to query history for',
          minLength: 1,
        },
        limit: {
          type: 'integer',
          description: 'Maximum number of history events to return',
          minimum: 1,
          maximum: 100,
          default: 20,
        },
        sinceTimestamp: {
          type: 'string',
          description: 'ISO-8601 timestamp cutoff for history entries',
        },
      },
      required: ['featureId'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        featureId: { type: 'string' },
        timeline: { type: 'array' },
        totalEvents: { type: 'number' },
      },
      required: ['featureId', 'timeline'],
    },
    requiredCapabilities: ['HISTORY_QUERY'],
    requiredScope: 'WORKSPACE_REQUIRED',
    safetyLevel: 'READ_ONLY',
    limits: {
      maxExecutionTimeMs: 8000,
      maxPayloadBytes: 256 * 1024,
    },
    enabled: true,
    idempotent: true,
    retryable: true,
  },

  // 7. projectmind_get_health
  {
    toolId: 'tool-get-health',
    name: 'projectmind_get_health',
    description: 'Query health scores, stability indices, risk metrics, and test coverage of features.',
    category: 'HEALTH',
    version: '1.0.0',
    operation: 'GET_HEALTH',
    inputSchema: {
      type: 'object',
      properties: {
        featureId: {
          type: 'string',
          description: 'Feature identifier to inspect health for',
          minLength: 1,
        },
      },
      required: ['featureId'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        featureId: { type: 'string' },
        healthScore: { type: 'number' },
        stability: { type: 'string' },
        riskFactors: { type: 'array' },
      },
      required: ['featureId'],
    },
    requiredCapabilities: ['HEALTH_QUERY'],
    requiredScope: 'WORKSPACE_REQUIRED',
    safetyLevel: 'READ_ONLY',
    limits: {
      maxExecutionTimeMs: 5000,
      maxPayloadBytes: 128 * 1024,
    },
    enabled: true,
    idempotent: true,
    retryable: true,
  },

  // 8. projectmind_explain_context
  {
    toolId: 'tool-explain-context',
    name: 'projectmind_explain_context',
    description: 'Explain why specific files, features, and snippets were included in a generated context package.',
    category: 'CONTEXT',
    version: '1.0.0',
    operation: 'EXPLAIN_CONTEXT',
    inputSchema: {
      type: 'object',
      properties: {
        packageId: {
          type: 'string',
          description: 'Identifier of the context package to explain',
          minLength: 1,
        },
      },
      required: ['packageId'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        packageId: { type: 'string' },
        reasons: { type: 'array' },
        scoringBreakdown: { type: 'object' },
      },
      required: ['packageId'],
    },
    requiredCapabilities: ['CONTEXT_EXPLANATION'],
    requiredScope: 'WORKSPACE_REQUIRED',
    safetyLevel: 'READ_ONLY',
    limits: {
      maxExecutionTimeMs: 5000,
      maxPayloadBytes: 128 * 1024,
    },
    enabled: true,
    idempotent: true,
    retryable: true,
  },

  // 9. projectmind_refresh_context
  {
    toolId: 'tool-refresh-context',
    name: 'projectmind_refresh_context',
    description: 'Re-evaluate and refresh a context package after local workspace modifications.',
    category: 'CONTEXT',
    version: '1.0.0',
    operation: 'REFRESH_CONTEXT',
    inputSchema: {
      type: 'object',
      properties: {
        packageId: {
          type: 'string',
          description: 'Identifier of existing context package to refresh',
          minLength: 1,
        },
        modifiedFiles: {
          type: 'array',
          description: 'List of files modified by the agent since package generation',
          items: { type: 'string' },
        },
      },
      required: ['packageId'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        packageId: { type: 'string' },
        refreshed: { type: 'boolean' },
        changes: { type: 'array' },
      },
      required: ['packageId', 'refreshed'],
    },
    requiredCapabilities: ['CONTEXT_REFRESH'],
    requiredScope: 'WORKSPACE_REQUIRED',
    safetyLevel: 'READ_ONLY',
    limits: {
      maxExecutionTimeMs: 10000,
      maxPayloadBytes: 256 * 1024,
    },
    enabled: true,
    idempotent: true,
    retryable: true,
  },

  // 10. projectmind_report_execution
  {
    toolId: 'tool-report-execution',
    name: 'projectmind_report_execution',
    description: 'Report task execution progress, changes made, and status back to ProjectMind.',
    category: 'EXECUTION',
    version: '1.0.0',
    operation: 'REPORT_EXECUTION',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Identifier of the executed task',
          minLength: 1,
        },
        status: {
          type: 'string',
          description: 'Current execution status of the task',
          enum: ['STARTED', 'IN_PROGRESS', 'COMPLETED', 'FAILED'],
        },
        modifiedFiles: {
          type: 'array',
          description: 'Files touched, altered, or created during execution',
          items: { type: 'string' },
        },
        summary: {
          type: 'string',
          description: 'Concise summary of changes made or actions executed',
          minLength: 1,
          maxLength: 5000,
        },
        operationId: {
          type: 'string',
          description: 'Unique client-supplied operation ID for idempotency deduplication',
        },
      },
      required: ['taskId', 'status', 'summary'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        acknowledged: { type: 'boolean' },
        recordedAt: { type: 'string' },
      },
      required: ['taskId', 'acknowledged'],
    },
    requiredCapabilities: ['EXECUTION_REPORT'],
    requiredScope: 'SESSION_REQUIRED',
    safetyLevel: 'REPORT_ONLY',
    limits: {
      maxExecutionTimeMs: 5000,
      maxPayloadBytes: 256 * 1024,
    },
    enabled: true,
    idempotent: false,
    retryable: true,
  },

  // 11. projectmind_report_verification
  {
    toolId: 'tool-report-verification',
    name: 'projectmind_report_verification',
    description: 'Report test outcomes, lint results, and verification feedback for completed code changes.',
    category: 'VERIFICATION',
    version: '1.0.0',
    operation: 'REPORT_VERIFICATION',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Identifier of the verified task',
          minLength: 1,
        },
        passed: {
          type: 'boolean',
          description: 'Whether all verification criteria / tests passed',
        },
        testResults: {
          type: 'array',
          description: 'Detailed unit / integration test results and statistics',
          items: { type: 'object' },
        },
        diagnostics: {
          type: 'array',
          description: 'Linter, compiler, or analyzer diagnostic messages',
          items: { type: 'string' },
        },
        summary: {
          type: 'string',
          description: 'Summary of verification outcome',
          minLength: 1,
          maxLength: 5000,
        },
        operationId: {
          type: 'string',
          description: 'Unique client-supplied operation ID for idempotency deduplication',
        },
      },
      required: ['taskId', 'passed', 'summary'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        recorded: { type: 'boolean' },
      },
      required: ['taskId', 'recorded'],
    },
    requiredCapabilities: ['VERIFICATION_REPORT'],
    requiredScope: 'SESSION_REQUIRED',
    safetyLevel: 'REPORT_ONLY',
    limits: {
      maxExecutionTimeMs: 5000,
      maxPayloadBytes: 256 * 1024,
    },
    enabled: true,
    idempotent: false,
    retryable: true,
  },

  // 12. projectmind_update_knowledge
  {
    toolId: 'tool-update-knowledge',
    name: 'projectmind_update_knowledge',
    description: 'Report discovered feature insights or architectural annotations to be incorporated into project memory.',
    category: 'KNOWLEDGE',
    version: '1.0.0',
    operation: 'UPDATE_KNOWLEDGE',
    inputSchema: {
      type: 'object',
      properties: {
        featureId: {
          type: 'string',
          description: 'Feature identifier to associate discovered insights with',
          minLength: 1,
        },
        insights: {
          type: 'array',
          description: 'List of observed architectural facts, conventions, or constraints',
          items: { type: 'string' },
          minItems: 1,
          maxItems: 50,
        },
        confidence: {
          type: 'number',
          description: 'Confidence rating between 0 and 1',
          minimum: 0,
          maximum: 1,
          default: 0.8,
        },
        operationId: {
          type: 'string',
          description: 'Unique client-supplied operation ID for idempotency deduplication',
        },
      },
      required: ['featureId', 'insights'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        featureId: { type: 'string' },
        stored: { type: 'boolean' },
        insightsRecorded: { type: 'number' },
      },
      required: ['featureId', 'stored'],
    },
    requiredCapabilities: ['KNOWLEDGE_UPDATE'],
    requiredScope: 'SESSION_REQUIRED',
    safetyLevel: 'REPORT_ONLY',
    limits: {
      maxExecutionTimeMs: 5000,
      maxPayloadBytes: 256 * 1024,
    },
    enabled: true,
    idempotent: false,
    retryable: true,
  },

  // 13. projectmind_start_task_context
  {
    toolId: 'tool-start-task-context',
    name: 'projectmind_start_task_context',
    description: 'Initialize a persistent task context session with tailored repository intelligence and token-budgeted package.',
    category: 'CONTEXT',
    version: '1.0.0',
    operation: 'START_TASK_CONTEXT',
    inputSchema: {
      type: 'object',
      properties: {
        taskText: {
          type: 'string',
          description: 'Detailed description of the development task being performed',
          minLength: 1,
        },
        taskId: {
          type: 'string',
          description: 'Optional unique task identifier',
        },
        taskTitle: {
          type: 'string',
          description: 'Short human-readable title for the task',
        },
        taskIntent: {
          type: 'string',
          description: 'Task intent driving context ranking and selection',
          enum: ['IMPLEMENTATION', 'EXPLANATION', 'REFACTORING', 'DEBUGGING', 'REVIEW'],
        },
        featureIds: {
          type: 'array',
          description: 'Optional explicit feature identifiers to focus context retrieval',
          items: { type: 'string' },
        },
        resourceIds: {
          type: 'array',
          description: 'Optional explicit resource/file paths to anchor context retrieval',
          items: { type: 'string' },
        },
        changedResources: {
          type: 'array',
          description: 'Optional already modified resources to incorporate into initial context',
          items: { type: 'string' },
        },
        tokenBudget: {
          type: 'integer',
          description: 'Maximum token budget for context package (default: 8000)',
          minimum: 100,
          maximum: 200000,
        },
        requestedSections: {
          type: 'array',
          description: 'Specific context sections requested',
          items: { type: 'string' },
        },
        freshnessPolicy: {
          type: 'string',
          enum: ['CURRENT', 'ALLOW_STALE', 'ANY'],
        },
        compactMode: {
          type: 'boolean',
          description: 'Whether to minimize verbose code blocks for high-level reasoning',
        },
      },
      required: ['taskText'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        task: { type: 'object' },
        contextSession: { type: 'object' },
        contextPackage: { type: 'object' },
        warnings: { type: 'array' },
        freshness: { type: 'string' },
        versionMetadata: { type: 'object' },
      },
      required: ['task', 'contextSession', 'contextPackage'],
    },
    requiredCapabilities: ['TASK_CONTEXT'],
    requiredScope: 'WORKSPACE_REQUIRED',
    safetyLevel: 'READ_ONLY',
    limits: {
      maxExecutionTimeMs: 15000,
      maxPayloadBytes: 512 * 1024,
    },
    enabled: true,
    idempotent: false,
    retryable: true,
  },

  // 14. projectmind_get_current_context
  {
    toolId: 'tool-get-current-context',
    name: 'projectmind_get_current_context',
    description: 'Retrieve the active context package for an ongoing task session, optionally calculating context deltas.',
    category: 'CONTEXT',
    version: '1.0.0',
    operation: 'GET_CURRENT_CONTEXT',
    inputSchema: {
      type: 'object',
      properties: {
        contextSessionId: {
          type: 'string',
          description: 'Active context session identifier',
          minLength: 1,
        },
        includeDelta: {
          type: 'boolean',
          description: 'Whether to compute and include incremental context delta',
          default: false,
        },
        baseContextVersion: {
          type: 'integer',
          description: 'Base version number for delta calculation',
          minimum: 1,
        },
        autoRefreshIfStale: {
          type: 'boolean',
          description: 'Automatically trigger smart refresh if context is marked stale (default: true)',
          default: true,
        },
      },
      required: ['contextSessionId'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        contextSessionId: { type: 'string' },
        taskId: { type: 'string' },
        contextVersion: { type: 'number' },
        freshness: { type: 'string' },
        wasRefreshed: { type: 'boolean' },
        contextPackage: { type: 'object' },
        delta: { type: 'object' },
        warnings: { type: 'array' },
      },
      required: ['contextSessionId', 'contextVersion', 'contextPackage'],
    },
    requiredCapabilities: ['TASK_CONTEXT'],
    requiredScope: 'WORKSPACE_REQUIRED',
    safetyLevel: 'READ_ONLY',
    limits: {
      maxExecutionTimeMs: 10000,
      maxPayloadBytes: 512 * 1024,
    },
    enabled: true,
    idempotent: true,
    retryable: true,
  },

  // 15. projectmind_refresh_task_context
  {
    toolId: 'tool-refresh-task-context',
    name: 'projectmind_refresh_task_context',
    description: 'Smart partial refresh of an active task context session, recalculating only stale sections.',
    category: 'CONTEXT',
    version: '1.0.0',
    operation: 'REFRESH_TASK_CONTEXT',
    inputSchema: {
      type: 'object',
      properties: {
        contextSessionId: {
          type: 'string',
          description: 'Active context session identifier to refresh',
          minLength: 1,
        },
        reason: {
          type: 'string',
          description: 'Reason trigger for context refresh',
          enum: [
            'TASK_CHANGED',
            'RESOURCE_CHANGED',
            'FEATURE_CHANGED',
            'DEPENDENCY_CHANGED',
            'BEHAVIOR_CHANGED',
            'HEALTH_CHANGED',
            'IMPACT_CHANGED',
            'KNOWLEDGE_UPDATED',
            'EXPLICIT_REQUEST',
            'STALE_CONTEXT',
            'CONTEXT_INVALIDATED',
            'UNKNOWN',
          ],
          default: 'EXPLICIT_REQUEST',
        },
        modifiedFiles: {
          type: 'array',
          description: 'List of recently modified file paths',
          items: { type: 'string' },
        },
        affectedFeatures: {
          type: 'array',
          description: 'Specific feature identifiers to recalculate',
          items: { type: 'string' },
        },
        staleSections: {
          type: 'array',
          description: 'Specific context sections that require rebuilding',
          items: { type: 'string' },
        },
        tokenBudget: {
          type: 'integer',
          description: 'Token budget for refreshed context',
          minimum: 100,
          maximum: 200000,
        },
        forceFullRefresh: {
          type: 'boolean',
          description: 'Bypass partial caching and force complete rebuild',
          default: false,
        },
      },
      required: ['contextSessionId'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        contextSessionId: { type: 'string' },
        packageId: { type: 'string' },
        refreshedVersion: { type: 'number' },
        previousVersion: { type: 'number' },
        reason: { type: 'string' },
        reusedSections: { type: 'array' },
        rebuiltSections: { type: 'array' },
        affectedFeatures: { type: 'array' },
        durationMs: { type: 'number' },
        estimatedTokens: { type: 'number' },
      },
      required: ['contextSessionId', 'packageId', 'refreshedVersion'],
    },
    requiredCapabilities: ['CONTEXT_REFRESH'],
    requiredScope: 'WORKSPACE_REQUIRED',
    safetyLevel: 'READ_ONLY',
    limits: {
      maxExecutionTimeMs: 15000,
      maxPayloadBytes: 512 * 1024,
    },
    enabled: true,
    idempotent: false,
    retryable: true,
  },

  // 16. projectmind_update_task_context
  {
    toolId: 'tool-update-task-context',
    name: 'projectmind_update_task_context',
    description: 'Update task goals, intent, or feature scope dynamically, updating context relevance seamlessly.',
    category: 'CONTEXT',
    version: '1.0.0',
    operation: 'UPDATE_TASK_CONTEXT',
    inputSchema: {
      type: 'object',
      properties: {
        contextSessionId: {
          type: 'string',
          description: 'Active context session identifier',
          minLength: 1,
        },
        newTaskText: {
          type: 'string',
          description: 'Refined or expanded description of the task',
        },
        newIntent: {
          type: 'string',
          description: 'Updated intent driving context optimization',
          enum: ['IMPLEMENTATION', 'EXPLANATION', 'REFACTORING', 'DEBUGGING', 'REVIEW'],
        },
        newTitle: {
          type: 'string',
          description: 'Updated task title',
        },
        featureIds: {
          type: 'array',
          description: 'Updated feature focus identifiers',
          items: { type: 'string' },
        },
        tokenBudget: {
          type: 'integer',
          description: 'Updated token budget',
          minimum: 100,
          maximum: 200000,
        },
      },
      required: ['contextSessionId'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        contextSessionId: { type: 'string' },
        taskId: { type: 'string' },
        updatedContextVersion: { type: 'number' },
        freshness: { type: 'string' },
        packageId: { type: 'string' },
        delta: { type: 'object' },
      },
      required: ['contextSessionId', 'taskId', 'updatedContextVersion'],
    },
    requiredCapabilities: ['TASK_CONTEXT'],
    requiredScope: 'WORKSPACE_REQUIRED',
    safetyLevel: 'READ_ONLY',
    limits: {
      maxExecutionTimeMs: 15000,
      maxPayloadBytes: 512 * 1024,
    },
    enabled: true,
    idempotent: false,
    retryable: true,
  },

  // 17. projectmind_pin_context
  {
    toolId: 'tool-pin-context',
    name: 'projectmind_pin_context',
    description: 'Pin a specific feature, file resource, or section in task context to ensure retention across budget limits.',
    category: 'CONTEXT',
    version: '1.0.0',
    operation: 'PIN_CONTEXT',
    inputSchema: {
      type: 'object',
      properties: {
        contextSessionId: {
          type: 'string',
          description: 'Active context session identifier',
          minLength: 1,
        },
        type: {
          type: 'string',
          description: 'Type of context element to pin',
          enum: ['FEATURE', 'RESOURCE', 'SECTION'],
        },
        targetId: {
          type: 'string',
          description: 'Identifier of the feature, resource path, or section name',
          minLength: 1,
        },
        reason: {
          type: 'string',
          description: 'Optional justification for pinning this element',
        },
      },
      required: ['contextSessionId', 'type', 'targetId'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        contextSessionId: { type: 'string' },
        pinId: { type: 'string' },
        type: { type: 'string' },
        targetId: { type: 'string' },
        pinnedAt: { type: 'string' },
        pinned: { type: 'boolean' },
      },
      required: ['contextSessionId', 'pinId', 'pinned'],
    },
    requiredCapabilities: ['CONTEXT_PINNING'],
    requiredScope: 'WORKSPACE_REQUIRED',
    safetyLevel: 'REPORT_ONLY',
    limits: {
      maxExecutionTimeMs: 5000,
      maxPayloadBytes: 128 * 1024,
    },
    enabled: true,
    idempotent: false,
    retryable: true,
  },

  // 18. projectmind_unpin_context
  {
    toolId: 'tool-unpin-context',
    name: 'projectmind_unpin_context',
    description: 'Remove a pinned feature, resource, or section from a task context session.',
    category: 'CONTEXT',
    version: '1.0.0',
    operation: 'UNPIN_CONTEXT',
    inputSchema: {
      type: 'object',
      properties: {
        contextSessionId: {
          type: 'string',
          description: 'Active context session identifier',
          minLength: 1,
        },
        pinId: {
          type: 'string',
          description: 'Identifier of the pin to remove',
          minLength: 1,
        },
      },
      required: ['contextSessionId', 'pinId'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        contextSessionId: { type: 'string' },
        pinId: { type: 'string' },
        unpinned: { type: 'boolean' },
      },
      required: ['contextSessionId', 'pinId', 'unpinned'],
    },
    requiredCapabilities: ['CONTEXT_PINNING'],
    requiredScope: 'WORKSPACE_REQUIRED',
    safetyLevel: 'REPORT_ONLY',
    limits: {
      maxExecutionTimeMs: 5000,
      maxPayloadBytes: 128 * 1024,
    },
    enabled: true,
    idempotent: false,
    retryable: true,
  },

  // 19. projectmind_report_context_feedback
  {
    toolId: 'tool-report-context-feedback',
    name: 'projectmind_report_context_feedback',
    description: 'Report telemetry and qualitative feedback on context usefulness for continuous optimization.',
    category: 'CONTEXT',
    version: '1.0.0',
    operation: 'REPORT_CONTEXT_FEEDBACK',
    inputSchema: {
      type: 'object',
      properties: {
        contextSessionId: {
          type: 'string',
          description: 'Active context session identifier',
          minLength: 1,
        },
        rating: {
          type: 'string',
          description: 'Rating of context usefulness',
          enum: ['USEFUL', 'PARTIALLY_USEFUL', 'INSUFFICIENT', 'IRRELEVANT', 'STALE'],
        },
        missingFeatures: {
          type: 'array',
          description: 'Features that should have been included in context',
          items: { type: 'string' },
        },
        missingResources: {
          type: 'array',
          description: 'Files or code assets that were missing from context',
          items: { type: 'string' },
        },
        unnecessaryResources: {
          type: 'array',
          description: 'Files included in context that were unneeded noise',
          items: { type: 'string' },
        },
        missingSections: {
          type: 'array',
          description: 'Sections that should have been provided',
          items: { type: 'string' },
        },
        comments: {
          type: 'string',
          description: 'Optional observations or suggestions from the agent',
        },
      },
      required: ['contextSessionId', 'rating'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        feedbackId: { type: 'string' },
        contextSessionId: { type: 'string' },
        rating: { type: 'string' },
        recorded: { type: 'boolean' },
        recordedAt: { type: 'string' },
      },
      required: ['feedbackId', 'contextSessionId', 'recorded'],
    },
    requiredCapabilities: ['CONTEXT_FEEDBACK'],
    requiredScope: 'SESSION_REQUIRED',
    safetyLevel: 'REPORT_ONLY',
    limits: {
      maxExecutionTimeMs: 5000,
      maxPayloadBytes: 256 * 1024,
    },
    enabled: true,
    idempotent: false,
    retryable: true,
  },

  // 20. projectmind_start_task
  {
    toolId: 'tool-start-task',
    name: 'projectmind_start_task',
    description: 'Create and start an official task, acquiring a session lease and generating initial task context.',
    category: 'TASK',
    version: '1.0.0',
    operation: 'START_TASK',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Short human-readable title for the task',
          minLength: 1,
        },
        description: {
          type: 'string',
          description: 'Detailed description of the development task being performed',
          minLength: 1,
        },
        taskId: {
          type: 'string',
          description: 'Optional client-provided task identifier',
        },
        intent: {
          type: 'string',
          description: 'Task intent driving context ranking and selection',
          enum: ['IMPLEMENTATION', 'EXPLANATION', 'REFACTORING', 'DEBUGGING', 'REVIEW'],
        },
        priority: {
          type: 'string',
          description: 'Task priority level',
          enum: ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'],
        },
        featureIds: {
          type: 'array',
          description: 'Optional explicit feature identifiers to focus context retrieval',
          items: { type: 'string' },
        },
        resourceIds: {
          type: 'array',
          description: 'Optional explicit resource/file paths to anchor context retrieval',
          items: { type: 'string' },
        },
        changedResources: {
          type: 'array',
          description: 'Optional already modified resources to incorporate into initial context',
          items: { type: 'string' },
        },
        tokenBudget: {
          type: 'integer',
          description: 'Maximum token budget for context package (default: 8000)',
          minimum: 100,
          maximum: 200000,
        },
        leaseDurationMs: {
          type: 'integer',
          description: 'Duration of initial task lease in milliseconds (default: 300000)',
          minimum: 10000,
        },
      },
      required: ['title', 'description'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        task: { type: 'object' },
        contextSession: { type: 'object' },
        contextPackage: { type: 'object' },
        state: { type: 'string' },
        freshness: { type: 'string' },
        contextVersion: { type: 'number' },
      },
      required: ['task', 'state'],
    },
    requiredCapabilities: ['TASK_CONTROL'],
    requiredScope: 'SESSION_REQUIRED',
    safetyLevel: 'REPORT_ONLY',
    limits: {
      maxExecutionTimeMs: 15000,
      maxPayloadBytes: 512 * 1024,
    },
    enabled: true,
    idempotent: false,
    retryable: true,
  },

  // 21. projectmind_get_task
  {
    toolId: 'tool-get-task',
    name: 'projectmind_get_task',
    description: 'Retrieve metadata, lifecycle state, and ownership details for a specific task.',
    category: 'TASK',
    version: '1.0.0',
    operation: 'GET_TASK',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Unique task identifier',
          minLength: 1,
        },
      },
      required: ['taskId'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        task: { type: 'object' },
      },
      required: ['task'],
    },
    requiredCapabilities: ['TASK_READ'],
    requiredScope: 'SESSION_REQUIRED',
    safetyLevel: 'READ_ONLY',
    limits: {
      maxExecutionTimeMs: 5000,
      maxPayloadBytes: 128 * 1024,
    },
    enabled: true,
    idempotent: true,
    retryable: true,
  },

  // 22. projectmind_get_task_state
  {
    toolId: 'tool-get-task-state',
    name: 'projectmind_get_task_state',
    description: 'Retrieve a complete runtime snapshot of a task, including execution, verification, lease, and context status.',
    category: 'TASK',
    version: '1.0.0',
    operation: 'GET_TASK_STATE',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Unique task identifier',
          minLength: 1,
        },
      },
      required: ['taskId'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        snapshot: { type: 'object' },
      },
      required: ['snapshot'],
    },
    requiredCapabilities: ['TASK_READ'],
    requiredScope: 'SESSION_REQUIRED',
    safetyLevel: 'READ_ONLY',
    limits: {
      maxExecutionTimeMs: 5000,
      maxPayloadBytes: 256 * 1024,
    },
    enabled: true,
    idempotent: true,
    retryable: true,
  },

  // 23. projectmind_get_task_progress
  {
    toolId: 'tool-get-task-progress',
    name: 'projectmind_get_task_progress',
    description: 'Retrieve structured progress, completed steps, outstanding conditions, and stage progress for a task.',
    category: 'TASK',
    version: '1.0.0',
    operation: 'GET_TASK_PROGRESS',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Unique task identifier',
          minLength: 1,
        },
      },
      required: ['taskId'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        progress: { type: 'object' },
      },
      required: ['progress'],
    },
    requiredCapabilities: ['TASK_READ'],
    requiredScope: 'SESSION_REQUIRED',
    safetyLevel: 'READ_ONLY',
    limits: {
      maxExecutionTimeMs: 5000,
      maxPayloadBytes: 128 * 1024,
    },
    enabled: true,
    idempotent: true,
    retryable: true,
  },

  // 24. projectmind_update_task
  {
    toolId: 'tool-update-task',
    name: 'projectmind_update_task',
    description: 'Update metadata, title, description, intent, or priority of an existing active task.',
    category: 'TASK',
    version: '1.0.0',
    operation: 'UPDATE_TASK',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Unique task identifier',
          minLength: 1,
        },
        title: {
          type: 'string',
          description: 'Updated task title',
        },
        description: {
          type: 'string',
          description: 'Updated task description',
        },
        intent: {
          type: 'string',
          description: 'Updated task intent',
          enum: ['IMPLEMENTATION', 'EXPLANATION', 'REFACTORING', 'DEBUGGING', 'REVIEW'],
        },
        priority: {
          type: 'string',
          description: 'Updated task priority',
          enum: ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'],
        },
        expectedVersion: {
          type: 'integer',
          description: 'Optimistic concurrency control version number',
        },
      },
      required: ['taskId'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        task: { type: 'object' },
      },
      required: ['task'],
    },
    requiredCapabilities: ['TASK_CONTROL'],
    requiredScope: 'SESSION_REQUIRED',
    safetyLevel: 'REPORT_ONLY',
    limits: {
      maxExecutionTimeMs: 5000,
      maxPayloadBytes: 128 * 1024,
    },
    enabled: true,
    idempotent: false,
    retryable: true,
  },

  // 25. projectmind_complete_task
  {
    toolId: 'tool-complete-task',
    name: 'projectmind_complete_task',
    description: 'Validate completion conditions and finalize a completed task and its context session.',
    category: 'TASK',
    version: '1.0.0',
    operation: 'COMPLETE_TASK',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Unique task identifier',
          minLength: 1,
        },
        expectedVersion: {
          type: 'integer',
          description: 'Optimistic concurrency control version number',
        },
        reason: {
          type: 'string',
          description: 'Optional completion reason or notes',
        },
      },
      required: ['taskId'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        task: { type: 'object' },
        completed: { type: 'boolean' },
      },
      required: ['task', 'completed'],
    },
    requiredCapabilities: ['TASK_CONTROL'],
    requiredScope: 'SESSION_REQUIRED',
    safetyLevel: 'REPORT_ONLY',
    limits: {
      maxExecutionTimeMs: 10000,
      maxPayloadBytes: 128 * 1024,
    },
    enabled: true,
    idempotent: false,
    retryable: true,
  },

  // 26. projectmind_resume_task
  {
    toolId: 'tool-resume-task',
    name: 'projectmind_resume_task',
    description: 'Resume a BLOCKED task back to IN_PROGRESS and re-acquire its execution lease.',
    category: 'TASK',
    version: '1.0.0',
    operation: 'RESUME_TASK',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Unique task identifier',
          minLength: 1,
        },
        expectedVersion: {
          type: 'integer',
          description: 'Optimistic concurrency control version number',
        },
        reason: {
          type: 'string',
          description: 'Reason for resuming the task',
        },
      },
      required: ['taskId'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        task: { type: 'object' },
        resumed: { type: 'boolean' },
      },
      required: ['task', 'resumed'],
    },
    requiredCapabilities: ['TASK_CONTROL'],
    requiredScope: 'SESSION_REQUIRED',
    safetyLevel: 'REPORT_ONLY',
    limits: {
      maxExecutionTimeMs: 5000,
      maxPayloadBytes: 128 * 1024,
    },
    enabled: true,
    idempotent: false,
    retryable: true,
  },

  // 27. projectmind_cancel_task
  {
    toolId: 'tool-cancel-task',
    name: 'projectmind_cancel_task',
    description: 'Cancel an active task with an explicit cancellation reason and release its lease.',
    category: 'TASK',
    version: '1.0.0',
    operation: 'CANCEL_TASK',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Unique task identifier',
          minLength: 1,
        },
        reason: {
          type: 'string',
          description: 'Mandatory reason for cancelling the task',
          minLength: 1,
        },
        expectedVersion: {
          type: 'integer',
          description: 'Optimistic concurrency control version number',
        },
      },
      required: ['taskId', 'reason'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        task: { type: 'object' },
        cancelled: { type: 'boolean' },
      },
      required: ['task', 'cancelled'],
    },
    requiredCapabilities: ['TASK_CONTROL'],
    requiredScope: 'SESSION_REQUIRED',
    safetyLevel: 'REPORT_ONLY',
    limits: {
      maxExecutionTimeMs: 5000,
      maxPayloadBytes: 128 * 1024,
    },
    enabled: true,
    idempotent: false,
    retryable: true,
  },

  // 28. projectmind_get_execution_observations
  {
    toolId: 'tool-get-execution-observations',
    name: 'projectmind_get_execution_observations',
    description: 'Retrieve structured, normalized execution observations for a task with bounded pagination and filtering.',
    category: 'OBSERVATION',
    version: '1.0.0',
    operation: 'GET_EXECUTION_OBSERVATIONS',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Unique task identifier',
          minLength: 1,
        },
        type: {
          type: 'string',
          description: 'Optional observation type filter (e.g. FILE_MODIFIED, TEST_COMPLETED)',
        },
        source: {
          type: 'string',
          description: 'Optional source filter (e.g. AGENT, VERIFICATION, SYSTEM)',
        },
        limit: {
          type: 'integer',
          description: 'Max records to return (1-100, default: 50)',
          minimum: 1,
          maximum: 100,
          default: 50,
        },
        offset: {
          type: 'integer',
          description: 'Pagination offset',
          minimum: 0,
          default: 0,
        },
      },
      required: ['taskId'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        observations: { type: 'array' },
        totalCount: { type: 'integer' },
        limit: { type: 'integer' },
        offset: { type: 'integer' },
        hasMore: { type: 'boolean' },
      },
      required: ['taskId', 'observations', 'totalCount', 'hasMore'],
    },
    requiredCapabilities: ['OBSERVATION_READ'],
    requiredScope: 'WORKSPACE_REQUIRED',
    safetyLevel: 'READ_ONLY',
    limits: {
      maxExecutionTimeMs: 5000,
      maxPayloadBytes: 256 * 1024,
    },
    enabled: true,
    idempotent: true,
    retryable: true,
  },

  // 29. projectmind_get_task_timeline
  {
    toolId: 'tool-get-task-timeline',
    name: 'projectmind_get_task_timeline',
    description: 'Retrieve the chronological, provenance-aware execution observation timeline for a task.',
    category: 'OBSERVATION',
    version: '1.0.0',
    operation: 'GET_TASK_TIMELINE',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Unique task identifier',
          minLength: 1,
        },
      },
      required: ['taskId'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        entries: { type: 'array' },
        totalEntries: { type: 'integer' },
        firstObservedAt: { type: 'string' },
        lastObservedAt: { type: 'string' },
      },
      required: ['taskId', 'entries', 'totalEntries'],
    },
    requiredCapabilities: ['OBSERVATION_READ'],
    requiredScope: 'WORKSPACE_REQUIRED',
    safetyLevel: 'READ_ONLY',
    limits: {
      maxExecutionTimeMs: 5000,
      maxPayloadBytes: 256 * 1024,
    },
    enabled: true,
    idempotent: true,
    retryable: true,
  },

  // 30. projectmind_get_execution_summary
  {
    toolId: 'tool-get-execution-summary',
    name: 'projectmind_get_execution_summary',
    description: 'Retrieve a structured execution summary for a task including changed resources, commands reported, verification results, blockers, and conflicts.',
    category: 'OBSERVATION',
    version: '1.0.0',
    operation: 'GET_EXECUTION_SUMMARY',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Unique task identifier',
          minLength: 1,
        },
      },
      required: ['taskId'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        workspaceId: { type: 'string' },
        repositoryId: { type: 'string' },
        executionState: { type: 'string' },
        changedResources: { type: 'array' },
        commandsReported: { type: 'array' },
        verificationResults: { type: 'object' },
        errors: { type: 'array' },
        blockers: { type: 'array' },
        conflicts: { type: 'array' },
        contextInvalidations: { type: 'array' },
        provenanceSummary: { type: 'object' },
        generatedAt: { type: 'string' },
      },
      required: ['taskId', 'executionState', 'changedResources', 'verificationResults'],
    },
    requiredCapabilities: ['OBSERVATION_READ'],
    requiredScope: 'WORKSPACE_REQUIRED',
    safetyLevel: 'READ_ONLY',
    limits: {
      maxExecutionTimeMs: 5000,
      maxPayloadBytes: 256 * 1024,
    },
    enabled: true,
    idempotent: true,
    retryable: true,
  },

  // 31. projectmind_get_observation_conflicts
  {
    toolId: 'tool-get-observation-conflicts',
    name: 'projectmind_get_observation_conflicts',
    description: 'Retrieve observed conflicts between agent execution reports and independent verification/system events.',
    category: 'OBSERVATION',
    version: '1.0.0',
    operation: 'GET_OBSERVATION_CONFLICTS',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Unique task identifier',
          minLength: 1,
        },
        status: {
          type: 'string',
          description: 'Optional conflict resolution status filter',
          enum: ['UNRESOLVED', 'RESOLVED_BY_TRUSTED_SOURCE', 'RESOLVED_BY_NEWER_OBSERVATION', 'RESOLVED_MANUALLY', 'ALL'],
        },
      },
      required: ['taskId'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        conflicts: { type: 'array' },
        unresolvedCount: { type: 'integer' },
      },
      required: ['taskId', 'conflicts', 'unresolvedCount'],
    },
    requiredCapabilities: ['OBSERVATION_READ'],
    requiredScope: 'WORKSPACE_REQUIRED',
    safetyLevel: 'READ_ONLY',
    limits: {
      maxExecutionTimeMs: 5000,
      maxPayloadBytes: 128 * 1024,
    },
    enabled: true,
    idempotent: true,
    retryable: true,
  },

  // 32. projectmind_get_verification
  {
    toolId: 'tool-get-verification',
    name: 'projectmind_get_verification',
    description: 'Retrieve specific verification records or filter verification evidence by task, feature, or resource path.',
    category: 'VERIFICATION',
    version: '1.0.0',
    operation: 'GET_VERIFICATION',
    inputSchema: {
      type: 'object',
      properties: {
        verificationId: {
          type: 'string',
          description: 'Optional unique verification identifier for exact lookup',
        },
        taskId: {
          type: 'string',
          description: 'Optional task identifier filter',
        },
        verificationType: {
          type: 'string',
          description: 'Optional verification type filter (TEST, BUILD, LINT, TYPECHECK, etc.)',
        },
        resourcePath: {
          type: 'string',
          description: 'Optional resource file path filter',
        },
        featureId: {
          type: 'string',
          description: 'Optional feature identifier filter',
        },
        limit: {
          type: 'integer',
          description: 'Maximum number of verification records to return (default: 50)',
          minimum: 1,
          maximum: 200,
          default: 50,
        },
      },
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        records: { type: 'array' },
        total: { type: 'integer' },
      },
      required: ['records', 'total'],
    },
    requiredCapabilities: ['VERIFICATION_READ'],
    requiredScope: 'WORKSPACE_REQUIRED',
    safetyLevel: 'READ_ONLY',
    limits: {
      maxExecutionTimeMs: 5000,
      maxPayloadBytes: 256 * 1024,
    },
    enabled: true,
    idempotent: true,
    retryable: true,
  },

  // 33. projectmind_get_verification_summary
  {
    toolId: 'tool-get-verification-summary',
    name: 'projectmind_get_verification_summary',
    description: 'Retrieve aggregated verification summary metrics (passed, failed, skipped, blocked, by-type metrics, latest status, trusted status, agent status) for a task.',
    category: 'VERIFICATION',
    version: '1.0.0',
    operation: 'GET_VERIFICATION_SUMMARY',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Unique task identifier',
          minLength: 1,
        },
      },
      required: ['taskId'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        total: { type: 'integer' },
        passed: { type: 'integer' },
        failed: { type: 'integer' },
        latestStatus: { type: 'string' },
        trustedStatus: { type: 'string' },
        agentReportedStatus: { type: 'string' },
        conflicts: { type: 'array' },
        byType: { type: 'object' },
      },
      required: ['taskId', 'total', 'passed', 'failed', 'latestStatus', 'conflicts'],
    },
    requiredCapabilities: ['VERIFICATION_READ'],
    requiredScope: 'WORKSPACE_REQUIRED',
    safetyLevel: 'READ_ONLY',
    limits: {
      maxExecutionTimeMs: 5000,
      maxPayloadBytes: 128 * 1024,
    },
    enabled: true,
    idempotent: true,
    retryable: true,
  },

  // 34. projectmind_get_verification_timeline
  {
    toolId: 'tool-get-verification-timeline',
    name: 'projectmind_get_verification_timeline',
    description: 'Retrieve chronological read-oriented verification timeline events and repository state bindings for a task.',
    category: 'VERIFICATION',
    version: '1.0.0',
    operation: 'GET_VERIFICATION_TIMELINE',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Unique task identifier',
          minLength: 1,
        },
      },
      required: ['taskId'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        entries: { type: 'array' },
        totalEntries: { type: 'integer' },
      },
      required: ['taskId', 'entries', 'totalEntries'],
    },
    requiredCapabilities: ['VERIFICATION_READ'],
    requiredScope: 'WORKSPACE_REQUIRED',
    safetyLevel: 'READ_ONLY',
    limits: {
      maxExecutionTimeMs: 5000,
      maxPayloadBytes: 256 * 1024,
    },
    enabled: true,
    idempotent: true,
    retryable: true,
  },

  // 35. projectmind_get_completion_evidence
  {
    toolId: 'tool-get-completion-evidence',
    name: 'projectmind_get_completion_evidence',
    description: 'Retrieve structured task completion evidence, verifying required evidence types, freshness, trusted provenance, and absence of unresolved conflicts.',
    category: 'VERIFICATION',
    version: '1.0.0',
    operation: 'GET_COMPLETION_EVIDENCE',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Unique task identifier',
          minLength: 1,
        },
        requireTrusted: {
          type: 'boolean',
          description: 'Optional flag to enforce trusted independent verification',
        },
      },
      required: ['taskId'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        canComplete: { type: 'boolean' },
        status: { type: 'string' },
        requiredConditions: { type: 'array' },
        actualEvidence: { type: 'array' },
        missingConditions: { type: 'array' },
        reasons: { type: 'array' },
      },
      required: ['taskId', 'canComplete', 'status', 'requiredConditions', 'actualEvidence', 'missingConditions', 'reasons'],
    },
    requiredCapabilities: ['VERIFICATION_READ'],
    requiredScope: 'WORKSPACE_REQUIRED',
    safetyLevel: 'READ_ONLY',
    limits: {
      maxExecutionTimeMs: 5000,
      maxPayloadBytes: 128 * 1024,
    },
    enabled: true,
    idempotent: true,
    retryable: true,
  },

  // 36. projectmind_get_verification_conflicts
  {
    toolId: 'tool-get-verification-conflicts',
    name: 'projectmind_get_verification_conflicts',
    description: 'Retrieve verification conflicts detected between agent reports and trusted/system verification results for a task.',
    category: 'VERIFICATION',
    version: '1.0.0',
    operation: 'GET_VERIFICATION_CONFLICTS',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Optional task identifier filter',
        },
      },
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        conflicts: { type: 'array' },
        totalConflicts: { type: 'integer' },
        unresolvedCount: { type: 'integer' },
      },
      required: ['conflicts', 'totalConflicts', 'unresolvedCount'],
    },
    requiredCapabilities: ['VERIFICATION_READ'],
    requiredScope: 'WORKSPACE_REQUIRED',
    safetyLevel: 'READ_ONLY',
    limits: {
      maxExecutionTimeMs: 5000,
      maxPayloadBytes: 128 * 1024,
    },
    enabled: true,
    idempotent: true,
    retryable: true,
  },
];


export function createCanonicalToolRegistry(): AgentToolRegistry {
  const registry = new AgentToolRegistry();
  for (const tool of CANONICAL_TOOLS) {
    registry.registerTool(tool);
  }
  return registry;
}
