/**
 * Production Release Metadata Model for ProjectMind.
 * Tracks versioning, compatibility ranges, migration preconditions, and rollback procedures.
 */

export interface ReleaseCompatibility {
  readonly minNodeVersion: string;
  readonly supportedEngines: readonly string[];
  readonly agentProtocols: readonly string[];
  readonly dbSchemaRange: string;
}

export interface RollbackGuidance {
  readonly supported: boolean;
  readonly mechanism: string;
  readonly instructions: readonly string[];
  readonly unsupportedConditions: readonly string[];
}

export interface ReleaseMetadata {
  readonly version: string;
  readonly buildId: string;
  readonly gitCommit: string;
  readonly gitBranch: string;
  readonly schemaVersion: string;
  readonly apiVersion: string;
  readonly runtimeVersion: string;
  readonly compatibility: ReleaseCompatibility;
  readonly migrationRequirements: readonly string[];
  readonly deploymentPrerequisites: readonly string[];
  readonly rollbackGuidance: RollbackGuidance;
  readonly configurationChanges: readonly string[];
  readonly securityChanges: readonly string[];
  readonly breakingChanges: readonly string[];
  readonly releaseNotes: string;
  readonly releaseDate: string;
}

export const CanonicalReleaseMetadata: ReleaseMetadata = {
  version: '1.0.0',
  buildId: 'pm-prod-20261009-v1.0.0',
  gitCommit: 'a64ea03b2788',
  gitBranch: 'main',
  schemaVersion: '2.0.0',
  apiVersion: 'v1',
  runtimeVersion: '1.0.0',
  compatibility: {
    minNodeVersion: '>=20.0.0',
    supportedEngines: ['node', 'v8'],
    agentProtocols: ['MCP-1.30.0', 'ProjectMindAgent-v1'],
    dbSchemaRange: '>=1.0.0 <=2.0.0',
  },
  migrationRequirements: [
    'Execute forward SQLite schema migrations up to version 2.0.0 before serving traffic.',
    'Verify Kuzu native graph engine database directory permissions.',
    'Initialize workspace and project storage directories before spawning multi-agent sessions.',
  ],
  deploymentPrerequisites: [
    'PROJECTMIND_SECRET_KEY / JWT_SECRET set in production environment.',
    'DATABASE_URL or SQLite data directory with write permissions.',
    'Zero live development flags (NODE_ENV=production, PROJECTMIND_ENV=production).',
    'Pre-allocated persistent volume for vector, graph, and workspace memory stores.',
  ],
  rollbackGuidance: {
    supported: true,
    mechanism: 'Atomic file-level / SQLite backup snapshot restore via DisasterRecoveryManager',
    instructions: [
      'Stop inbound agent traffic and pause AgentSessionManager.',
      'Restore previous database snapshot from verified backup directory.',
      'Deploy previous release binary / container tag.',
      'Verify platform health endpoints (/api/v1/health, /api/v1/health/liveness).',
      'Resume inbound agent traffic.',
    ],
    unsupportedConditions: [
      'In-place destructive SQLite migrations without pre-migration backup.',
      'Replay of uncommitted knowledge update transactions without write-ahead journal.',
    ],
  },
  configurationChanges: [
    'Enforced strict security startup validation (PROJECTMIND_SECRET_KEY mandatory in production).',
    'Standardized rate limits and payload sizing limits across API and agent runtime.',
    'Added Phase 9.8 PluginRuntime permission manifest validation and sandbox configuration.',
    'Added Phase 9.9 Enterprise Intelligence multi-tenant isolation and analytics retention policies.',
  ],
  securityChanges: [
    'Added 5-tier Data Classification and Credential Lifecycle governance.',
    'Integrated Prompt Injection and Cross-Scope data guards on all agent tool interfaces.',
    'Enforced permission-boundary isolation for external plugins and SDK clients.',
    'Enforced tenant-scoped queries across enterprise analytics and project memory stores.',
  ],
  breakingChanges: [],
  releaseNotes:
    'ProjectMind 1.0.0 production-ready platform release. Completes Phase 1 through Phase 9 (Phases 9.1-9.10) with deterministic repository extraction, feature intelligence, context orchestration, multi-agent collaboration, task planning, project memory, learning feedback, plugin/SDK ecosystem, enterprise analytics, and complete v1.0 release certification.',
  releaseDate: '2026-10-09',
};
