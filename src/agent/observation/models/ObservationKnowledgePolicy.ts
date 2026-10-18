import type { ObservationType } from './ObservationType.js';
import type { ObservationRetentionCategory } from './ObservationRetention.js';

export interface ObservationKnowledgeRule {
  readonly type: ObservationType;
  readonly defaultRetention: ObservationRetentionCategory;
  readonly contributesToEvidence: boolean;
  readonly triggersContextInvalidation: boolean;
  readonly requiresVerification: boolean;
  readonly isProjectRelevant: boolean;
}

export interface ObservationKnowledgePolicy {
  readonly rules: Readonly<Partial<Record<ObservationType, ObservationKnowledgeRule>>>;
  readonly maxPayloadBytes: number;
  readonly maxCommandLength: number;
  readonly redactSecrets: boolean;
  readonly allowEphemeralStorage: boolean;
}

export const DEFAULT_OBSERVATION_KNOWLEDGE_POLICY: ObservationKnowledgePolicy = {
  maxPayloadBytes: 64 * 1024, // 64 KB
  maxCommandLength: 2000,
  redactSecrets: true,
  allowEphemeralStorage: true,
  rules: {
    // Task Lifecycle
    TASK_STARTED: {
      type: 'TASK_STARTED',
      defaultRetention: 'TASK_SCOPED',
      contributesToEvidence: false,
      triggersContextInvalidation: false,
      requiresVerification: false,
      isProjectRelevant: false,
    },
    TASK_PROGRESS: {
      type: 'TASK_PROGRESS',
      defaultRetention: 'TASK_SCOPED',
      contributesToEvidence: false,
      triggersContextInvalidation: false,
      requiresVerification: false,
      isProjectRelevant: false,
    },
    TASK_BLOCKED: {
      type: 'TASK_BLOCKED',
      defaultRetention: 'TASK_SCOPED',
      contributesToEvidence: false,
      triggersContextInvalidation: false,
      requiresVerification: false,
      isProjectRelevant: false,
    },
    TASK_COMPLETED: {
      type: 'TASK_COMPLETED',
      defaultRetention: 'PROJECT_RELEVANT',
      contributesToEvidence: true,
      triggersContextInvalidation: false,
      requiresVerification: true,
      isProjectRelevant: true,
    },
    TASK_FAILED: {
      type: 'TASK_FAILED',
      defaultRetention: 'TASK_SCOPED',
      contributesToEvidence: true,
      triggersContextInvalidation: false,
      requiresVerification: false,
      isProjectRelevant: false,
    },

    // File Operations
    FILE_CREATED: {
      type: 'FILE_CREATED',
      defaultRetention: 'PROJECT_RELEVANT',
      contributesToEvidence: true,
      triggersContextInvalidation: true,
      requiresVerification: false,
      isProjectRelevant: true,
    },
    FILE_MODIFIED: {
      type: 'FILE_MODIFIED',
      defaultRetention: 'PROJECT_RELEVANT',
      contributesToEvidence: true,
      triggersContextInvalidation: true,
      requiresVerification: false,
      isProjectRelevant: true,
    },
    FILE_DELETED: {
      type: 'FILE_DELETED',
      defaultRetention: 'PROJECT_RELEVANT',
      contributesToEvidence: true,
      triggersContextInvalidation: true,
      requiresVerification: false,
      isProjectRelevant: true,
    },
    FILE_RENAMED: {
      type: 'FILE_RENAMED',
      defaultRetention: 'PROJECT_RELEVANT',
      contributesToEvidence: true,
      triggersContextInvalidation: true,
      requiresVerification: false,
      isProjectRelevant: true,
    },
    FILE_MOVED: {
      type: 'FILE_MOVED',
      defaultRetention: 'PROJECT_RELEVANT',
      contributesToEvidence: true,
      triggersContextInvalidation: true,
      requiresVerification: false,
      isProjectRelevant: true,
    },

    // Symbol Operations
    SYMBOL_CREATED: {
      type: 'SYMBOL_CREATED',
      defaultRetention: 'PROJECT_RELEVANT',
      contributesToEvidence: true,
      triggersContextInvalidation: true,
      requiresVerification: false,
      isProjectRelevant: true,
    },
    SYMBOL_MODIFIED: {
      type: 'SYMBOL_MODIFIED',
      defaultRetention: 'PROJECT_RELEVANT',
      contributesToEvidence: true,
      triggersContextInvalidation: true,
      requiresVerification: false,
      isProjectRelevant: true,
    },
    SYMBOL_DELETED: {
      type: 'SYMBOL_DELETED',
      defaultRetention: 'PROJECT_RELEVANT',
      contributesToEvidence: true,
      triggersContextInvalidation: true,
      requiresVerification: false,
      isProjectRelevant: true,
    },
    SYMBOL_RENAMED: {
      type: 'SYMBOL_RENAMED',
      defaultRetention: 'PROJECT_RELEVANT',
      contributesToEvidence: true,
      triggersContextInvalidation: true,
      requiresVerification: false,
      isProjectRelevant: true,
    },

    // Architectural
    DEPENDENCY_CHANGED: {
      type: 'DEPENDENCY_CHANGED',
      defaultRetention: 'PROJECT_RELEVANT',
      contributesToEvidence: true,
      triggersContextInvalidation: true,
      requiresVerification: false,
      isProjectRelevant: true,
    },
    CONFIGURATION_CHANGED: {
      type: 'CONFIGURATION_CHANGED',
      defaultRetention: 'PROJECT_RELEVANT',
      contributesToEvidence: true,
      triggersContextInvalidation: true,
      requiresVerification: false,
      isProjectRelevant: true,
    },
    API_CHANGED: {
      type: 'API_CHANGED',
      defaultRetention: 'HISTORICAL',
      contributesToEvidence: true,
      triggersContextInvalidation: true,
      requiresVerification: false,
      isProjectRelevant: true,
    },
    DATA_SCHEMA_CHANGED: {
      type: 'DATA_SCHEMA_CHANGED',
      defaultRetention: 'HISTORICAL',
      contributesToEvidence: true,
      triggersContextInvalidation: true,
      requiresVerification: false,
      isProjectRelevant: true,
    },

    // Command Operations
    COMMAND_STARTED: {
      type: 'COMMAND_STARTED',
      defaultRetention: 'EPHEMERAL',
      contributesToEvidence: false,
      triggersContextInvalidation: false,
      requiresVerification: false,
      isProjectRelevant: false,
    },
    COMMAND_COMPLETED: {
      type: 'COMMAND_COMPLETED',
      defaultRetention: 'TASK_SCOPED',
      contributesToEvidence: false,
      triggersContextInvalidation: false,
      requiresVerification: false,
      isProjectRelevant: false,
    },
    COMMAND_FAILED: {
      type: 'COMMAND_FAILED',
      defaultRetention: 'TASK_SCOPED',
      contributesToEvidence: false,
      triggersContextInvalidation: false,
      requiresVerification: false,
      isProjectRelevant: false,
    },

    // Build Operations
    BUILD_STARTED: {
      type: 'BUILD_STARTED',
      defaultRetention: 'EPHEMERAL',
      contributesToEvidence: false,
      triggersContextInvalidation: false,
      requiresVerification: false,
      isProjectRelevant: false,
    },
    BUILD_COMPLETED: {
      type: 'BUILD_COMPLETED',
      defaultRetention: 'TASK_SCOPED',
      contributesToEvidence: true,
      triggersContextInvalidation: false,
      requiresVerification: true,
      isProjectRelevant: false,
    },
    BUILD_FAILED: {
      type: 'BUILD_FAILED',
      defaultRetention: 'TASK_SCOPED',
      contributesToEvidence: true,
      triggersContextInvalidation: false,
      requiresVerification: true,
      isProjectRelevant: false,
    },

    // Test Operations
    TEST_STARTED: {
      type: 'TEST_STARTED',
      defaultRetention: 'EPHEMERAL',
      contributesToEvidence: false,
      triggersContextInvalidation: false,
      requiresVerification: false,
      isProjectRelevant: false,
    },
    TEST_COMPLETED: {
      type: 'TEST_COMPLETED',
      defaultRetention: 'TASK_SCOPED',
      contributesToEvidence: true,
      triggersContextInvalidation: false,
      requiresVerification: true,
      isProjectRelevant: false,
    },
    TEST_FAILED: {
      type: 'TEST_FAILED',
      defaultRetention: 'TASK_SCOPED',
      contributesToEvidence: true,
      triggersContextInvalidation: false,
      requiresVerification: true,
      isProjectRelevant: false,
    },

    // Lint
    LINT_STARTED: {
      type: 'LINT_STARTED',
      defaultRetention: 'EPHEMERAL',
      contributesToEvidence: false,
      triggersContextInvalidation: false,
      requiresVerification: false,
      isProjectRelevant: false,
    },
    LINT_COMPLETED: {
      type: 'LINT_COMPLETED',
      defaultRetention: 'TASK_SCOPED',
      contributesToEvidence: true,
      triggersContextInvalidation: false,
      requiresVerification: true,
      isProjectRelevant: false,
    },
    LINT_FAILED: {
      type: 'LINT_FAILED',
      defaultRetention: 'TASK_SCOPED',
      contributesToEvidence: true,
      triggersContextInvalidation: false,
      requiresVerification: true,
      isProjectRelevant: false,
    },

    // Typecheck
    TYPECHECK_STARTED: {
      type: 'TYPECHECK_STARTED',
      defaultRetention: 'EPHEMERAL',
      contributesToEvidence: false,
      triggersContextInvalidation: false,
      requiresVerification: false,
      isProjectRelevant: false,
    },
    TYPECHECK_COMPLETED: {
      type: 'TYPECHECK_COMPLETED',
      defaultRetention: 'TASK_SCOPED',
      contributesToEvidence: true,
      triggersContextInvalidation: false,
      requiresVerification: true,
      isProjectRelevant: false,
    },
    TYPECHECK_FAILED: {
      type: 'TYPECHECK_FAILED',
      defaultRetention: 'TASK_SCOPED',
      contributesToEvidence: true,
      triggersContextInvalidation: false,
      requiresVerification: true,
      isProjectRelevant: false,
    },

    // Diagnostics
    ERROR_REPORTED: {
      type: 'ERROR_REPORTED',
      defaultRetention: 'TASK_SCOPED',
      contributesToEvidence: true,
      triggersContextInvalidation: false,
      requiresVerification: false,
      isProjectRelevant: false,
    },
    WARNING_REPORTED: {
      type: 'WARNING_REPORTED',
      defaultRetention: 'TASK_SCOPED',
      contributesToEvidence: false,
      triggersContextInvalidation: false,
      requiresVerification: false,
      isProjectRelevant: false,
    },

    // Context Operations
    CONTEXT_REQUESTED: {
      type: 'CONTEXT_REQUESTED',
      defaultRetention: 'EPHEMERAL',
      contributesToEvidence: false,
      triggersContextInvalidation: false,
      requiresVerification: false,
      isProjectRelevant: false,
    },
    CONTEXT_REFRESHED: {
      type: 'CONTEXT_REFRESHED',
      defaultRetention: 'TASK_SCOPED',
      contributesToEvidence: false,
      triggersContextInvalidation: false,
      requiresVerification: false,
      isProjectRelevant: false,
    },
    CONTEXT_INVALIDATED: {
      type: 'CONTEXT_INVALIDATED',
      defaultRetention: 'TASK_SCOPED',
      contributesToEvidence: false,
      triggersContextInvalidation: false,
      requiresVerification: false,
      isProjectRelevant: false,
    },

    // Verification Lifecycle
    VERIFICATION_STARTED: {
      type: 'VERIFICATION_STARTED',
      defaultRetention: 'EPHEMERAL',
      contributesToEvidence: false,
      triggersContextInvalidation: false,
      requiresVerification: false,
      isProjectRelevant: false,
    },
    VERIFICATION_COMPLETED: {
      type: 'VERIFICATION_COMPLETED',
      defaultRetention: 'PROJECT_RELEVANT',
      contributesToEvidence: true,
      triggersContextInvalidation: false,
      requiresVerification: true,
      isProjectRelevant: true,
    },
    VERIFICATION_FAILED: {
      type: 'VERIFICATION_FAILED',
      defaultRetention: 'TASK_SCOPED',
      contributesToEvidence: true,
      triggersContextInvalidation: false,
      requiresVerification: true,
      isProjectRelevant: false,
    },

    // Agent Specific
    AGENT_DECISION: {
      type: 'AGENT_DECISION',
      defaultRetention: 'PROJECT_RELEVANT',
      contributesToEvidence: true,
      triggersContextInvalidation: false,
      requiresVerification: false,
      isProjectRelevant: true,
    },
    AGENT_BLOCKER: {
      type: 'AGENT_BLOCKER',
      defaultRetention: 'TASK_SCOPED',
      contributesToEvidence: false,
      triggersContextInvalidation: false,
      requiresVerification: false,
      isProjectRelevant: false,
    },
  },
};
